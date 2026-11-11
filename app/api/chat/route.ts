import { NextResponse } from "next/server";

export const runtime = "nodejs";

type ChatRequest = { message?: unknown };

export async function POST(request: Request) {
  let body: ChatRequest;
  try {
    body = (await request.json()) as ChatRequest;
  } catch {
    return NextResponse.json({ error: "صيغة الطلب غير صحيحة." }, { status: 400 });
  }

  if (typeof body.message !== "string") {
    return NextResponse.json({ error: "اكتب رسالة نصية أولاً." }, { status: 400 });
  }

  const message = body.message.trim();
  if (!message) {
    return NextResponse.json({ error: "الرسالة فارغة." }, { status: 400 });
  }
  if (message.length > 8000) {
    return NextResponse.json({ error: "الرسالة طويلة جداً؛ الحد الأقصى 8000 حرف." }, { status: 413 });
  }

  const apiKey = process.env.OPENAI_API_KEY;
  if (!apiKey) {
    return NextResponse.json(
      { error: "لم يتم إعداد مفتاح الذكاء الاصطناعي على الخادم بعد. أضف OPENAI_API_KEY في متغيرات البيئة." },
      { status: 503 },
    );
  }

  try {
    const upstream = await fetch("https://api.openai.com/v1/chat/completions", {
      method: "POST",
      headers: {
        Authorization: "Bearer " + apiKey,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model: process.env.OPENAI_MODEL || "gpt-4o-mini",
        messages: [
          {
            role: "system",
            content: "أنت مساعد NEXORA AI. أجب باللغة العربية الواضحة ما لم يطلب المستخدم لغة أخرى. لا تدّع تنفيذ إجراءات أو الوصول إلى ملفات أو أنظمة غير متاحة لك.",
          },
          { role: "user", content: message },
        ],
        temperature: 0.4,
      }),
      signal: AbortSignal.timeout(30000),
      cache: "no-store",
    });

    if (!upstream.ok) {
      const status = upstream.status === 429 ? 429 : 502;
      return NextResponse.json(
        { error: upstream.status === 429 ? "تم تجاوز حد الاستخدام أو الرصيد لدى مزود الذكاء الاصطناعي." : "تعذر على مزود الذكاء الاصطناعي إكمال الطلب. تحقق من المفتاح والرصيد وإعدادات النموذج." },
        { status },
      );
    }

    const result = await upstream.json();
    const reply = result?.choices?.[0]?.message?.content;
    if (typeof reply !== "string" || !reply.trim()) {
      return NextResponse.json({ error: "وصل رد غير متوقع من مزود الذكاء الاصطناعي." }, { status: 502 });
    }
    return NextResponse.json({ reply: reply.trim() });
  } catch {
    return NextResponse.json(
      { error: "انتهت مهلة الاتصال بمزود الذكاء الاصطناعي أو تعذر الوصول إليه." },
      { status: 504 },
    );
  }
}
