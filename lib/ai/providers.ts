export type ProviderName = "openai" | "google" | "anthropic";
export type ProviderConfig = { provider: ProviderName; model: string; apiKey: string };

export function getProviderConfig(providerValue?: string): ProviderConfig {
  const provider = (providerValue || process.env.AI_PROVIDER || "openai") as ProviderName;
  if (provider === "google") return { provider, model: process.env.GOOGLE_MODEL || "gemini-2.5-flash", apiKey: process.env.GOOGLE_API_KEY || "" };
  if (provider === "anthropic") return { provider, model: process.env.ANTHROPIC_MODEL || "claude-sonnet-4-5", apiKey: process.env.ANTHROPIC_API_KEY || "" };
  return { provider: "openai", model: process.env.OPENAI_MODEL || "gpt-4o-mini", apiKey: process.env.OPENAI_API_KEY || "" };
}

async function readProviderResponse(response: Response, provider: ProviderName): Promise<any> {
  const raw = await response.text();
  let data: any = {};
  try { data = raw ? JSON.parse(raw) : {}; } catch { data = {}; }

  if (!response.ok) {
    const apiMessage = data?.error?.message || data?.message || data?.error?.status || "";
    const safeMessage = String(apiMessage || raw || "لم يرسل المزود تفاصيل إضافية.")
      .replace(/AIza[0-9A-Za-z_-]{20,}/g, "[مفتاح مخفي]")
      .slice(0, 500);
    throw new Error(`فشل مزود ${provider} (HTTP ${response.status}): ${safeMessage}`);
  }
  return data;
}

export async function generateText(messages: Array<{role:"system"|"user"|"assistant";content:string}>, providerValue?: string) {
  const config = getProviderConfig(providerValue);
  if (!config.apiKey) throw new Error(`لم يتم إعداد مفتاح مزود ${config.provider} على الخادم.`);
  const signal = AbortSignal.timeout(60000);

  if (config.provider === "anthropic") {
    const response = await fetch("https://api.anthropic.com/v1/messages", {
      method:"POST",
      headers:{"x-api-key":config.apiKey,"anthropic-version":"2023-06-01","content-type":"application/json"},
      body:JSON.stringify({model:config.model,max_tokens:2048,system:messages.find(m=>m.role==="system")?.content,messages:messages.filter(m=>m.role!=="system").map(m=>({role:m.role,content:m.content}))}),
      signal,
      cache:"no-store"
    });
    const data = await readProviderResponse(response, config.provider);
    return String(data?.content?.map((x:{text?:string})=>x.text||"").join("") || "");
  }

  const base = config.provider === "google"
    ? "https://generativelanguage.googleapis.com/v1beta/openai/chat/completions"
    : "https://api.openai.com/v1/chat/completions";
  const response = await fetch(base, {
    method:"POST",
    headers:{"Authorization":`Bearer ${config.apiKey}`,"Content-Type":"application/json"},
    body:JSON.stringify({model:config.model,messages,temperature:0.3}),
    signal,
    cache:"no-store"
  });
  const data = await readProviderResponse(response, config.provider);
  const reply = data?.choices?.[0]?.message?.content;
  if (typeof reply !== "string" || !reply.trim()) {
    throw new Error(`استجاب مزود ${config.provider} دون نص. تحقق من اسم النموذج وصلاحية المفتاح.`);
  }
  return reply;
}
