import { NextResponse } from "next/server";
import { isAuthorized } from "@/lib/auth";
import { generateText } from "@/lib/ai/providers";

export const runtime = "nodejs";
export const maxDuration = 60;

type ChatMessage = { role: "user" | "assistant"; content: string };
type ChatRequest = { message?: unknown; messages?: unknown; provider?: string };

export async function POST(request: Request) {
  if (!(await isAuthorized(request))) {
    return NextResponse.json({ error: "سجّل الدخول أولاً من صفحة المسؤول." }, { status: 401 });
  }

  let body: ChatRequest;
  try { body = (await request.json()) as ChatRequest; }
  catch { return NextResponse.json({ error: "صيغة الطلب غير صحيحة." }, { status: 400 }); }

  const messages: ChatMessage[] = Array.isArray(body.messages)
    ? body.messages as ChatMessage[]
    : typeof body.message === "string" ? [{ role: "user", content: body.message }] : [];

  if (!messages.length || messages.length > 40 || messages.some((m) =>
    !m || !["user", "assistant"].includes(m.role) || typeof m.content !== "string" || !m.content.trim() || m.content.length > 8000
  )) {
    return NextResponse.json({ error: "سجل المحادثة غير صالح أو تجاوز الحد المسموح." }, { status: 400 });
  }
  if (messages.reduce((sum, m) => sum + m.content.length, 0) > 30000) {
    return NextResponse.json({ error: "المحادثة طويلة جداً؛ ابدأ محادثة جديدة." }, { status: 413 });
  }

  try {
    const reply = await generateText([
      { role: "system", content: "أنت NEXORA AI، مساعد ذكي محترف. أجب باللغة العربية الواضحة ما لم يطلب المستخدم لغة أخرى. حافظ على سياق المحادثة. لا تدّع تنفيذ إجراءات أو الوصول إلى ملفات أو أنظمة غير متاحة لك. إذا طلب المستخدم إجراءً خارجياً، وضّح ما تستطيع فعله فعلياً." },
      ...messages,
    ], body.provider);
    return NextResponse.json({ reply });
  } catch (error) {
    return NextResponse.json({ error: error instanceof Error ? error.message : "تعذر الاتصال بمزود الذكاء الاصطناعي." }, { status: 503 });
  }
}
