import { NextResponse } from "next/server";
import { isAuthorized } from "@/lib/auth";
import { generateText } from "@/lib/ai/providers";
export const runtime = "nodejs";
// Allow enough time for the provider's bounded 2 x 25-second attempts.
export const maxDuration = 60;
type ChatRequest = { message?: unknown; provider?: string };
export async function POST(request: Request) {
 if(!(await isAuthorized(request))) return NextResponse.json({error:"سجّل الدخول أولاً من صفحة المسؤول."},{status:401});
 let body: ChatRequest;
 try { body=(await request.json()) as ChatRequest; } catch { return NextResponse.json({error:"صيغة الطلب غير صحيحة."},{status:400}); }
 if(typeof body.message!=="string"||!body.message.trim()) return NextResponse.json({error:"اكتب رسالة نصية أولاً."},{status:400});
 if(body.message.length>8000) return NextResponse.json({error:"الرسالة طويلة جداً؛ الحد الأقصى 8000 حرف."},{status:413});
 try {
  const reply=await generateText([
   {role:"system",content:"أنت مساعد NEXORA AI. أجب باللغة العربية الواضحة ما لم يطلب المستخدم لغة أخرى. لا تدّع تنفيذ إجراءات أو الوصول إلى ملفات أو أنظمة غير متاحة لك."},
   {role:"user",content:body.message.trim()},
  ],body.provider);
  return NextResponse.json({reply});
 } catch(error) { return NextResponse.json({error:error instanceof Error?error.message:"تعذر الاتصال بمزود الذكاء الاصطناعي."},{status:503}); }
}
