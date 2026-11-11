import { NextResponse } from "next/server";
import { isAuthorized } from "@/lib/auth";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

type Check = { id: string; label: string; configured: boolean; required: boolean; detail: string };

export async function GET(request: Request) {
  if (!(await isAuthorized(request))) {
    return NextResponse.json({ error: "سجّل الدخول أولاً." }, { status: 401 });
  }

  const provider = process.env.AI_PROVIDER || "openai";
  const aiKey = provider === "google"
    ? Boolean(process.env.GOOGLE_API_KEY)
    : provider === "anthropic"
      ? Boolean(process.env.ANTHROPIC_API_KEY)
      : Boolean(process.env.OPENAI_API_KEY);

  const checks: Check[] = [
    { id: "admin", label: "دخول المسؤول والجلسات", configured: Boolean(process.env.NEXORA_ADMIN_PASSWORD && process.env.NEXORA_SESSION_SECRET), required: true, detail: "كلمة مرور المسؤول ومفتاح توقيع الجلسة" },
    { id: "ai", label: "مزود الذكاء الاصطناعي", configured: aiKey, required: true, detail: "المزود المحدد: " + provider },
    { id: "replicate-image", label: "توليد الصور", configured: Boolean(process.env.REPLICATE_API_TOKEN), required: false, detail: "Replicate API token؛ النموذج الافتراضي FLUX Schnell" },
    { id: "replicate-video", label: "توليد الفيديو", configured: Boolean(process.env.REPLICATE_API_TOKEN && process.env.REPLICATE_VIDEO_MODEL), required: false, detail: "Replicate token واسم نموذج فيديو مدعوم" },
    { id: "search", label: "البحث المستقل", configured: Boolean(process.env.TAVILY_API_KEY), required: false, detail: "Tavily API key" },
    { id: "github", label: "تكامل GitHub App", configured: Boolean(process.env.GITHUB_APP_ID && process.env.GITHUB_APP_PRIVATE_KEY && process.env.GITHUB_APP_INSTALLATION_ID), required: false, detail: "App ID وPrivate Key وInstallation ID" },
    { id: "vercel", label: "النشر عبر Vercel API", configured: Boolean(process.env.VERCEL_TOKEN), required: false, detail: "Vercel token؛ يلزم أيضاً ربط المستودع وصلاحياته" },
    { id: "scheduler", label: "تخزين المهام المجدولة", configured: Boolean(process.env.UPSTASH_REDIS_REST_URL && process.env.UPSTASH_REDIS_REST_TOKEN), required: false, detail: "Upstash Redis REST URL وToken" },
    { id: "cron", label: "مصادقة مشغل الجدولة", configured: Boolean(process.env.CRON_SECRET), required: false, detail: "CRON_SECRET؛ يعمل وفق جدول Cron المضبوط في الاستضافة" },
    { id: "realtime", label: "الصوت المباشر", configured: Boolean(process.env.OPENAI_API_KEY), required: false, detail: "OpenAI API key وRealtime model متاح" },
  ];

  const requiredReady = checks.filter((item) => item.required).every((item) => item.configured);
  return NextResponse.json(
    { provider, requiredReady, checks, generatedAt: new Date().toISOString(), note: "هذا فحص وجود إعدادات البيئة فقط؛ لا يختبر صلاحية المفاتيح أو الاتصال بالخدمات الخارجية." },
    { headers: { "Cache-Control": "no-store, max-age=0" } },
  );
}
