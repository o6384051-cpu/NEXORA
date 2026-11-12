export type ProviderName = "openai" | "google" | "anthropic";
export type ProviderConfig = { provider: ProviderName; model: string; apiKey: string };
const PROVIDERS: ProviderName[] = ["openai", "google", "anthropic"];

export function getProviderConfig(providerValue?: string): ProviderConfig {
  const requested = providerValue || process.env.AI_PROVIDER || "openai";
  if (!PROVIDERS.includes(requested as ProviderName)) {
    throw new Error("مزود الذكاء الاصطناعي غير معروف. اختر OpenAI أو Google أو Anthropic.");
  }
  const provider = requested as ProviderName;
  if (provider === "google") return { provider, model: process.env.GOOGLE_MODEL || "gemini-3.5-flash-lite", apiKey: process.env.GOOGLE_API_KEY || "" };
  if (provider === "anthropic") return { provider, model: process.env.ANTHROPIC_MODEL || "claude-sonnet-4-5", apiKey: process.env.ANTHROPIC_API_KEY || "" };
  return { provider, model: process.env.OPENAI_MODEL || "gpt-4o-mini", apiKey: process.env.OPENAI_API_KEY || "" };
}

async function requestWithRetry(url: string, init: RequestInit, options: { timeoutMs?: number; maxAttempts?: number } = {}): Promise<Response> {
  const timeoutMs = options.timeoutMs ?? 25000;
  const maxAttempts = options.maxAttempts ?? 2;
  let lastError: unknown;
  for (let attempt = 0; attempt < maxAttempts; attempt++) {
    // Give each attempt its own timeout; a timed-out first attempt must not poison the retry.
    const signal = AbortSignal.timeout(timeoutMs);
    try {
      const response = await fetch(url, { ...init, signal, cache: "no-store" });
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

async function readProviderResponse(response: Response, provider: ProviderName, apiKey: string) {
  const raw = await response.text();
  let data: { error?: { message?: string; status?: string }; message?: string; content?: Array<{ text?: string }>; choices?: Array<{ message?: { content?: string } }> } = {};
  try { data = raw ? JSON.parse(raw) as typeof data : {}; } catch { data = {}; }

  if (!response.ok) {
    const message = String(data.error?.message || data.message || data.error?.status || raw || "لم يرسل المزود تفاصيل إضافية.")
      .replaceAll(apiKey, "[مفتاح مخفي]")
      .replace(/AIza[0-9A-Za-z_-]{20,}/g, "[مفتاح مخفي]")
      .replace(/sk-[A-Za-z0-9_-]{12,}/g, "[مفتاح مخفي]")
      .slice(0, 500);
    throw new Error(`فشل مزود ${provider} (HTTP ${response.status}): ${message}`);
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
    body: JSON.stringify({ model: config.model, messages, ...(config.provider === "openai" ? { temperature: 0.3 } : {}) }),
  }, requestOptions);
  const data = await readProviderResponse(response, config.provider, config.apiKey);
  const content = data.choices?.[0]?.message?.content;
  if (typeof content !== "string" || !content.trim()) {
    throw new Error(`أعاد مزود ${config.provider} استجابة فارغة أو غير متوقعة.`);
  }
  return content;
}
