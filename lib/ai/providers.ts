export type ProviderName = "openai" | "google" | "anthropic";
export type ProviderConfig = { provider: ProviderName; model: string; apiKey: string };
export class ProviderHttpError extends Error {
  constructor(
    message: string,
    public readonly status: number,
    public readonly retryAfterSeconds?: number,
  ) {
    super(message);
    this.name = "ProviderHttpError";
  }
}
const PROVIDERS: ProviderName[] = ["openai", "google", "anthropic"];

export function isProviderName(value: unknown): value is ProviderName {
  return typeof value === "string" && PROVIDERS.includes(value as ProviderName);
}

export function getProviderConfig(providerValue?: string): ProviderConfig {
  const requested = providerValue || process.env.AI_PROVIDER || "openai";
  if (!isProviderName(requested)) {
    throw new Error("مزود الذكاء الاصطناعي غير معروف. اختر OpenAI أو Google أو Anthropic.");
  }
  const provider = requested as ProviderName;
  if (provider === "google") return { provider, model: process.env.GOOGLE_MODEL || "gemini-3.8-flash", apiKey: process.env.GOOGLE_API_KEY || "" };
  if (provider === "anthropic") return { provider, model: process.env.ANTHROPIC_MODEL || "claude-sonnet-4-5", apiKey: process.env.ANTHROPIC_API_KEY || "" };
  return { provider, model: process.env.OPENAI_MODEL || "gpt-4o-mini", apiKey: process.env.OPENAI_API_KEY || "" };
}

async function requestWithRetry(url: string, init: RequestInit, options: { timeoutMs?: number; maxAttempts?: number } = {}): Promise<Response> {
  const timeoutMs = options.timeoutMs ?? 25000;
  const maxAttempts = options.maxAttempts ?? 2;
  let lastError: unknown;
  for (let attempt = 0; attempt < maxAttempts; attempt++) {
    const signal = AbortSignal.timeout(timeoutMs);
    try {
      const response = await fetch(url, { ...init, signal, cache: "no-store" });
      // A 429 is returned immediately: blindly retrying can worsen quota exhaustion.
      if (attempt < maxAttempts - 1 && response.status >= 500) {
        await response.body?.cancel().catch(() => undefined);
        await new Promise((resolve) => setTimeout(resolve, 350));
        continue;
      }
      return response;
    } catch (error) {
      lastError = error;
      if (attempt < maxAttempts - 1) {
        await new Promise((resolve) => setTimeout(resolve, 350));
        continue;
      }
    }
  }
  if (lastError instanceof Error && (lastError.name === "TimeoutError" || lastError.name === "AbortError")) {
    throw new Error(`انتهت مهلة الاتصال بمزود الذكاء الاصطناعي بعد ${maxAttempts} محاولة/محاولات (${timeoutMs / 1000} ثانية للمحاولة).`);
  }
  throw new Error(`تعذر الاتصال بمزود الذكاء الاصطناعي بعد ${maxAttempts} محاولة/محاولات.`);
}

function getRetryAfterSeconds(response: Response): number | undefined {
  const value = response.headers.get("retry-after");
  if (!value) return undefined;
  const seconds = Number(value);
  if (Number.isFinite(seconds)) return Math.max(1, Math.min(300, Math.ceil(seconds)));
  const date = Date.parse(value);
  if (Number.isNaN(date)) return undefined;
  return Math.max(1, Math.min(300, Math.ceil((date - Date.now()) / 1000)));
}

async function readProviderResponse(response: Response, provider: ProviderName, apiKey: string) {
  const raw = await response.text();
  let data: { error?: { message?: string; status?: string; code?: string }; message?: string; content?: Array<{ text?: string }>; choices?: Array<{ message?: { content?: string } }> } = {};
  try { data = raw ? JSON.parse(raw) as typeof data : {}; } catch { data = {}; }

  if (!response.ok) {
    const upstreamMessage = String(data.error?.message || data.message || data.error?.status || raw || "لم يرسل المزود تفاصيل إضافية.")
      .replaceAll(apiKey, "[مفتاح مخفي]")
      .replace(/AIza[0-9A-Za-z_-]{20,}/g, "[مفتاح مخفي]")
      .replace(/sk-[A-Za-z0-9_-]{12,}/g, "[مفتاح مخفي]")
      .slice(0, 500);
    const message = response.status === 429
      ? provider === "google"
        ? /quota|daily|resource_exhausted/i.test(upstreamMessage)
          ? "وصل Gemini إلى حد الحصة المتاحة لهذا المشروع. انتظر تجدد الحصة أو راجع حدود الاستخدام في Google AI Studio."
          : "طلبات Gemini كثيرة حالياً. انتظر قليلاً ثم أعد المحاولة."
        : `وصل مزود ${provider} إلى حد الطلبات المسموح. انتظر قليلاً ثم أعد المحاولة.`
      : `فشل مزود ${provider} (HTTP ${response.status}): ${upstreamMessage}`;
    throw new ProviderHttpError(message, response.status, getRetryAfterSeconds(response));
  }
  return data;
}

export async function generateText(messages: Array<{ role: "system" | "user" | "assistant"; content: string }>, providerValue?: string, requestOptions: { timeoutMs?: number; maxAttempts?: number } = {}) {
  const config = getProviderConfig(providerValue);
  if (!config.apiKey) throw new Error(`لم يتم إعداد مفتاح مزود ${config.provider} على الخادم.`);

  if (config.provider === "anthropic") {
    const response = await requestWithRetry("https://api.anthropic.com/v1/messages", {
      method: "POST",
      headers: { "x-api-key": config.apiKey, "anthropic-version": "2023-06-01", "content-type": "application/json" },
      body: JSON.stringify({
        model: config.model,
        max_tokens: 2048,
        system: messages.find((message) => message.role === "system")?.content,
        messages: messages.filter((message) => message.role !== "system").map((message) => ({ role: message.role, content: message.content })),
      }),
    }, requestOptions);
    const data = await readProviderResponse(response, config.provider, config.apiKey);
    const text = data.content?.map((part) => part.text || "").join("") || "";
    if (!text.trim()) throw new Error("أعاد مزود Anthropic استجابة فارغة.");
    return text;
  }

  const endpoint = config.provider === "google"
    ? "https://generativelanguage.googleapis.com/v1beta/openai/chat/completions"
    : "https://api.openai.com/v1/chat/completions";
  const response = await requestWithRetry(endpoint, {
    method: "POST",
    headers: { Authorization: `Bearer ${config.apiKey}`, "Content-Type": "application/json" },
    body: JSON.stringify({
      model: config.model,
      messages,
      ...(config.provider === "openai" ? { temperature: 0.3 } : {}),
      ...(config.provider === "google" ? { reasoning_effort: "low" } : {}),
    }),
  }, requestOptions);
  const data = await readProviderResponse(response, config.provider, config.apiKey);
  const content = data.choices?.[0]?.message?.content;
  if (typeof content !== "string" || !content.trim()) {
    throw new Error(`أعاد مزود ${config.provider} استجابة فارغة أو غير متوقعة.`);
  }
  return content;
}
