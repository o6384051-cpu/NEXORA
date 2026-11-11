export type ProviderName = "openai" | "google" | "anthropic";
export type ProviderConfig = { provider: ProviderName; model: string; apiKey: string };

const PROVIDERS: ProviderName[] = ["openai", "google", "anthropic"];

export function getProviderConfig(providerValue?: string): ProviderConfig {
  const requested = providerValue || process.env.AI_PROVIDER || "openai";
  if (!PROVIDERS.includes(requested as ProviderName)) {
    throw new Error("مزود الذكاء الاصطناعي غير معروف. اختر OpenAI أو Google أو Anthropic.");
  }
  const provider = requested as ProviderName;
  if (provider === "google") return { provider, model: process.env.GOOGLE_MODEL || "gemini-2.5-flash", apiKey: process.env.GOOGLE_API_KEY || "" };
  if (provider === "anthropic") return { provider, model: process.env.ANTHROPIC_MODEL || "claude-sonnet-4-5", apiKey: process.env.ANTHROPIC_API_KEY || "" };
  return { provider, model: process.env.OPENAI_MODEL || "gpt-4o-mini", apiKey: process.env.OPENAI_API_KEY || "" };
}

function errorMessage(data: unknown, fallback: string): string {
  if (data && typeof data === "object" && "error" in data) {
    const error = (data as { error?: unknown }).error;
    if (error && typeof error === "object" && "message" in error && typeof (error as { message?: unknown }).message === "string") {
      return (error as { message: string }).message.slice(0, 500);
    }
  }
  return fallback;
}

async function requestWithRetry(url: string, init: RequestInit): Promise<Response> {
  let lastError: unknown;
  for (let attempt = 0; attempt < 2; attempt++) {
    try {
      const response = await fetch(url, { ...init, signal: AbortSignal.timeout(45000), cache: "no-store" });
      if (attempt === 0 && (response.status === 429 || response.status >= 500)) {
        await response.text().catch(() => "");
        await new Promise((resolve) => setTimeout(resolve, 700));
        continue;
      }
      return response;
    } catch (error) {
      lastError = error;
      if (attempt === 0) {
        await new Promise((resolve) => setTimeout(resolve, 700));
        continue;
      }
    }
  }
  if (lastError instanceof Error && lastError.name === "TimeoutError") {
    throw new Error("انتهت مهلة الاتصال بمزود الذكاء الاصطناعي بعد محاولتين.");
  }
  throw new Error("تعذر الاتصال بمزود الذكاء الاصطناعي بعد محاولتين.");
}

export async function generateText(messages: Array<{ role: "system" | "user" | "assistant"; content: string }>, providerValue?: string) {
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
    });
    const data: unknown = await response.json().catch(() => null);
    if (!response.ok) throw new Error(errorMessage(data, "فشل مزود Anthropic في معالجة الطلب."));
    const content = data && typeof data === "object" && "content" in data ? (data as { content?: Array<{ text?: string }> }).content : undefined;
    const text = content?.map((part) => part.text || "").join("") || "";
    if (!text.trim()) throw new Error("أعاد مزود Anthropic استجابة فارغة.");
    return text;
  }

  const endpoint = config.provider === "google"
    ? "https://generativelanguage.googleapis.com/v1beta/openai/chat/completions"
    : "https://api.openai.com/v1/chat/completions";
  const response = await requestWithRetry(endpoint, {
    method: "POST",
    headers: { Authorization: `Bearer ${config.apiKey}`, "Content-Type": "application/json" },
    body: JSON.stringify({ model: config.model, messages, temperature: 0.3 }),
  });
  const data: unknown = await response.json().catch(() => null);
  if (!response.ok) throw new Error(errorMessage(data, `فشل مزود ${config.provider} في معالجة الطلب.`));
  const choices = data && typeof data === "object" && "choices" in data ? (data as { choices?: Array<{ message?: { content?: unknown } }> }).choices : undefined;
  const content = choices?.[0]?.message?.content;
  if (typeof content !== "string" || !content.trim()) throw new Error(`أعاد مزود ${config.provider} استجابة فارغة أو غير متوقعة.`);
  return content;
}
