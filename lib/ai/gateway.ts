import { ProviderHttpError } from "@/lib/ai/providers";

type Message = { role: "system" | "user" | "assistant"; content: string };

export async function generateGatewayText(messages: Message[]): Promise<string> {
  const apiKey = process.env.AI_GATEWAY_API_KEY;
  if (!apiKey) throw new Error("لم يتم إعداد AI Gateway على الخادم.");

  const response = await fetch("https://ai-gateway.vercel.sh/v1/chat/completions", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${apiKey}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      model: process.env.AI_GATEWAY_MODEL || "openai/gpt-4.1-mini",
      messages,
      max_tokens: 2048,
      temperature: 0.3,
    }),
    cache: "no-store",
    signal: AbortSignal.timeout(25000),
  });

  const raw = await response.text();
  let data: {
    error?: { message?: string; code?: string };
    choices?: Array<{ message?: { content?: unknown } }>;
  } = {};
  try {
    data = raw ? JSON.parse(raw) as typeof data : {};
  } catch {
    data = {};
  }

  if (!response.ok) {
    const safeMessage = String(data.error?.message || raw || "لم يرسل AI Gateway تفاصيل إضافية.")
      .replaceAll(apiKey, "[مفتاح مخفي]")
      .slice(0, 400);
    const message = response.status === 429
      ? "تم بلوغ حد الاستخدام أو الميزانية في AI Gateway. راجع رصيدك وحدود الإنفاق."
      : `فشل AI Gateway (HTTP ${response.status}): ${safeMessage}`;
    throw new ProviderHttpError(message, response.status);
  }

  const content = data.choices?.[0]?.message?.content;
  if (typeof content !== "string" || !content.trim()) {
    throw new Error("أعاد AI Gateway استجابة فارغة أو غير متوقعة.");
  }
  return content;
}
