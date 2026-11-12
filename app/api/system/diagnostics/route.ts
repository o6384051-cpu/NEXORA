import { NextResponse } from "next/server";
import { createSign } from "node:crypto";
import { isAuthorized } from "@/lib/auth";

export const runtime = "nodejs";
export const maxDuration = 30;

type CheckStatus = "ok" | "failed" | "not_configured" | "config_only";
type Check = { id: string; label: string; status: CheckStatus; detail: string };

function b64(value: string) {
  return Buffer.from(value).toString("base64url");
}

async function githubInstallationCheck() {
  const appId = process.env.GITHUB_APP_ID;
  const installation = process.env.GITHUB_APP_INSTALLATION_ID;
  const privateKey = process.env.GITHUB_APP_PRIVATE_KEY?.replace(/\\n/g, "\n");
  if (!appId || !installation || !privateKey) throw new Error("إعداد GitHub App غير مكتمل.");

  const now = Math.floor(Date.now() / 1000);
  const header = b64(JSON.stringify({ alg: "RS256", typ: "JWT" }));
  const payload = b64(JSON.stringify({ iat: now - 30, exp: now + 8 * 60, iss: appId }));
  const unsigned = header + "." + payload;
  const signer = createSign("RSA-SHA256");
  signer.update(unsigned);
  signer.end();
  const jwt = unsigned + "." + signer.sign(privateKey, "base64url");

  const tokenResponse = await fetch(
    "https://api.github.com/app/installations/" + installation + "/access_tokens",
    {
      method: "POST",
      headers: { Authorization: "Bearer " + jwt, Accept: "application/vnd.github+json", "X-GitHub-Api-Version": "2022-11-28" },
      signal: AbortSignal.timeout(9000),
      cache: "no-store",
    },
  );
  if (!tokenResponse.ok) throw new Error("GitHub رفض إصدار رمز التثبيت (HTTP " + tokenResponse.status + ").");
  const tokenData = await tokenResponse.json() as { token?: string };
  if (!tokenData.token) throw new Error("لم يُصدر GitHub رمز تثبيت صالحاً.");

  const testResponse = await fetch("https://api.github.com/installation/repositories?per_page=1", {
    headers: { Authorization: "Bearer " + tokenData.token, Accept: "application/vnd.github+json", "X-GitHub-Api-Version": "2022-11-28" },
    signal: AbortSignal.timeout(9000),
    cache: "no-store",
  });
  if (!testResponse.ok) throw new Error("رمز GitHub صالح لكن تعذر قراءة المستودعات (HTTP " + testResponse.status + ").");
  return "تم إصدار رمز تثبيت ونجح اتصال المستودعات.";
}

async function providerCheck() {
  const provider = process.env.AI_PROVIDER || "openai";
  const model = provider === "google"
    ? process.env.GOOGLE_MODEL || "gemini-3.8-flash"
    : provider === "anthropic"
      ? process.env.ANTHROPIC_MODEL || "claude-sonnet-4-5"
      : process.env.OPENAI_MODEL || "gpt-4o-mini";

  if (provider === "google") {
    const key = process.env.GOOGLE_API_KEY;
    if (!key) throw new Error("GOOGLE_API_KEY غير مضبوط.");
    const response = await fetch("https://generativelanguage.googleapis.com/v1beta/openai/chat/completions", {
      method: "POST",
      headers: { Authorization: "Bearer " + key, "Content-Type": "application/json" },
      body: JSON.stringify({ model, messages: [{ role: "user", content: "Reply with exactly OK." }], max_tokens: 8 }),
      signal: AbortSignal.timeout(15000), cache: "no-store",
    });
    const data = await response.json().catch(() => ({})) as { choices?: Array<{ message?: { content?: string } }>; error?: { message?: string } };
    if (!response.ok) throw new Error("فشل اختبار توليد Gemini (HTTP " + response.status + "): " + (data.error?.message || "خطأ غير محدد"));
    if (!data.choices?.[0]?.message?.content?.trim()) throw new Error("اتصل Gemini لكنه لم يُرجع نصاً.");
    return "نجح طلب توليد فعلي باستخدام " + model + ". استهلك الاختبار عدداً قليلاً من الرموز.";
  }
  if (provider === "anthropic") {
    const key = process.env.ANTHROPIC_API_KEY;
    if (!key) throw new Error("ANTHROPIC_API_KEY غير مضبوط.");
    const response = await fetch("https://api.anthropic.com/v1/messages", {
      method: "POST",
      headers: { "x-api-key": key, "anthropic-version": "2023-06-01", "content-type": "application/json" },
      body: JSON.stringify({ model, max_tokens: 8, messages: [{ role: "user", content: "Reply with exactly OK." }] }),
      signal: AbortSignal.timeout(15000), cache: "no-store",
    });
    const data = await response.json().catch(() => ({})) as { content?: Array<{ text?: string }>; error?: { message?: string } };
    if (!response.ok) throw new Error("فشل اختبار توليد Anthropic (HTTP " + response.status + "): " + (data.error?.message || "خطأ غير محدد"));
    if (!data.content?.some((part) => part.text?.trim())) throw new Error("اتصل Anthropic لكنه لم يُرجع نصاً.");
    return "نجح طلب توليد فعلي باستخدام " + model + ". استهلك الاختبار عدداً قليلاً من الرموز.";
  }
  if (provider === "openai") {
    const key = process.env.OPENAI_API_KEY;
    if (!key) throw new Error("OPENAI_API_KEY غير مضبوط.");
    const response = await fetch("https://api.openai.com/v1/chat/completions", {
      method: "POST",
      headers: { Authorization: "Bearer " + key, "Content-Type": "application/json" },
      body: JSON.stringify({ model, messages: [{ role: "user", content: "Reply with exactly OK." }], max_tokens: 8 }),
      signal: AbortSignal.timeout(15000), cache: "no-store",
    });
    const data = await response.json().catch(() => ({})) as { choices?: Array<{ message?: { content?: string } }>; error?: { message?: string } };
    if (!response.ok) throw new Error("فشل اختبار توليد OpenAI (HTTP " + response.status + "): " + (data.error?.message || "خطأ غير محدد"));
    if (!data.choices?.[0]?.message?.content?.trim()) throw new Error("اتصل OpenAI لكنه لم يُرجع نصاً.");
    return "نجح طلب توليد فعلي باستخدام " + model + ". استهلك الاختبار عدداً قليلاً من الرموز.";
  }
  throw new Error("قيمة AI_PROVIDER غير معروفة.");
}

async function replicateModelCheck(modelName: string) {
  const token = process.env.REPLICATE_API_TOKEN;
  if (!token) throw new Error("REPLICATE_API_TOKEN غير مضبوط.");
  const [modelRef, version] = modelName.split(":");
  const endpoint = version
    ? "https://api.replicate.com/v1/models/" + modelRef + "/versions/" + version
    : "https://api.replicate.com/v1/models/" + modelRef;
  const response = await fetch(endpoint, {
    headers: { Authorization: "Bearer " + token },
    signal: AbortSignal.timeout(9000),
    cache: "no-store",
  });
  if (!response.ok) throw new Error("Replicate لم يقبل إعداد النموذج (HTTP " + response.status + ").");
  return "تم التحقق من صلاحية الوصول إلى النموذج دون تشغيل عملية توليد.";
}

async function runCheck(
  id: string,
  label: string,
  configured: boolean,
  test: () => Promise<string>,
): Promise<Check> {
  if (!configured) return { id, label, status: "not_configured", detail: "الخدمة غير مهيأة في متغيرات البيئة." };
  try {
    return { id, label, status: "ok", detail: await test() };
  } catch (error) {
    const detail = error instanceof Error ? error.message : "فشل الاتصال بالخدمة.";
    return { id, label, status: "failed", detail: detail.slice(0, 220) };
  }
}

export async function POST(request: Request) {
  if (!(await isAuthorized(request))) {
    return NextResponse.json({ error: "سجّل الدخول أولاً." }, { status: 401 });
  }

  const checks = await Promise.all([
    runCheck("ai", "مزود الذكاء الاصطناعي", Boolean(process.env.AI_PROVIDER && (
      (process.env.AI_PROVIDER === "google" && process.env.GOOGLE_API_KEY) ||
      (process.env.AI_PROVIDER === "openai" && process.env.OPENAI_API_KEY) ||
      (process.env.AI_PROVIDER === "anthropic" && process.env.ANTHROPIC_API_KEY)
    )), providerCheck),
    runCheck("search", "البحث Tavily", Boolean(process.env.TAVILY_API_KEY), async () => {
      const response = await fetch("https://api.tavily.com/search", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ api_key: process.env.TAVILY_API_KEY, query: "NEXORA AI connection test", search_depth: "basic", max_results: 1 }),
        signal: AbortSignal.timeout(9000), cache: "no-store",
      });
      if (!response.ok) throw new Error("Tavily أعاد HTTP " + response.status + ".");
      const data = await response.json() as { results?: unknown[] };
      return "نجح البحث الحي وأعاد " + (data.results?.length ?? 0) + " نتيجة. يستهلك هذا الاختبار رصيد استعلام واحد.";
    }),
    runCheck("github", "GitHub App", Boolean(process.env.GITHUB_APP_ID && process.env.GITHUB_APP_PRIVATE_KEY && process.env.GITHUB_APP_INSTALLATION_ID), githubInstallationCheck),
    runCheck("vercel", "Vercel API", Boolean(process.env.VERCEL_TOKEN), async () => {
      const response = await fetch("https://api.vercel.com/v2/user", {
        headers: { Authorization: "Bearer " + process.env.VERCEL_TOKEN },
        signal: AbortSignal.timeout(9000), cache: "no-store",
      });
      if (!response.ok) throw new Error("Vercel رفض الرمز (HTTP " + response.status + ").");
      return "نجح التحقق من رمز Vercel.";
    }),
    runCheck("replicate", "Replicate API", Boolean(process.env.REPLICATE_API_TOKEN), async () => {
      const response = await fetch("https://api.replicate.com/v1/account", {
        headers: { Authorization: "Bearer " + process.env.REPLICATE_API_TOKEN },
        signal: AbortSignal.timeout(9000), cache: "no-store",
      });
      if (!response.ok) throw new Error("Replicate رفض الرمز (HTTP " + response.status + ").");
      return "نجح التحقق من حساب Replicate دون إنشاء صورة أو فيديو.";
    }),
    runCheck("image-model", "نموذج توليد الصور", Boolean(process.env.REPLICATE_API_TOKEN), () =>
      replicateModelCheck(process.env.REPLICATE_IMAGE_MODEL || "black-forest-labs/flux-schnell")),
    runCheck("video-model", "نموذج توليد الفيديو", Boolean(process.env.REPLICATE_API_TOKEN && process.env.REPLICATE_VIDEO_MODEL), () =>
      replicateModelCheck(process.env.REPLICATE_VIDEO_MODEL!)),
    runCheck("scheduler", "قاعدة المهام Upstash Redis", Boolean(process.env.UPSTASH_REDIS_REST_URL && process.env.UPSTASH_REDIS_REST_TOKEN), async () => {
      const response = await fetch(process.env.UPSTASH_REDIS_REST_URL!, {
        method: "POST",
        headers: { Authorization: "Bearer " + process.env.UPSTASH_REDIS_REST_TOKEN, "Content-Type": "application/json" },
        body: JSON.stringify(["PING"]),
        signal: AbortSignal.timeout(9000), cache: "no-store",
      });
      const data = await response.json() as { result?: unknown; error?: string };
      if (!response.ok || data.error || data.result !== "PONG") throw new Error(data.error || "لم يُرجع Redis استجابة PONG.");
      return "استجاب Redis برسالة PONG.";
    }),
  ]);

  const realtimeConfigured = Boolean(process.env.OPENAI_API_KEY);
  checks.push(await runCheck("realtime", "صلاحية مفتاح OpenAI للصوت المباشر", realtimeConfigured, async () => {
    const response = await fetch("https://api.openai.com/v1/models", {
      headers: { Authorization: "Bearer " + process.env.OPENAI_API_KEY },
      signal: AbortSignal.timeout(9000), cache: "no-store",
    });
    if (!response.ok) throw new Error("OpenAI رفض المفتاح (HTTP " + response.status + ").");
    const data = await response.json() as { data?: Array<{ id?: string }> };
    const available = (data.data || []).some((model) => /realtime/i.test(model.id || ""));
    if (!available) throw new Error("المفتاح صالح، لكن قائمة النماذج لا تعرض نموذج Realtime؛ يلزم التحقق من صلاحية الحساب والنموذج.");
    return "ظهر نموذج Realtime في قائمة النماذج. يلزم اختبار جلسة صوت فعلية على جهاز Android.";
  }));

  checks.push({
    id: "cron",
    label: "إعداد مشغل المهام Cron",
    status: process.env.CRON_SECRET ? "config_only" : "not_configured",
    detail: process.env.CRON_SECRET
      ? "سر المصادقة موجود. لم يُشغّل الاختبار أي مهام مجدولة حتى لا ينفذ أعمالاً حقيقية."
      : "CRON_SECRET غير مضبوط.",
  });

  const passed = checks.filter((item) => item.status === "ok").length;
  const failed = checks.filter((item) => item.status === "failed").length;
  return NextResponse.json({
    checks,
    summary: { passed, failed, notConfigured: checks.filter((item) => item.status === "not_configured").length, configOnly: checks.filter((item) => item.status === "config_only").length },
    generatedAt: new Date().toISOString(),
    note: "اختبار الذكاء الاصطناعي ينفذ طلب توليد قصيراً ويستهلك رموزاً قليلة؛ اختبار Tavily يستهلك رصيد استعلام واحد. لا يتم إنشاء صور أو فيديو أو نشر تطبيق. لا يثبت نجاح الاتصال وحده اكتمال تدفق المستخدم.",
  }, { headers: { "Cache-Control": "no-store, max-age=0" } });
}
