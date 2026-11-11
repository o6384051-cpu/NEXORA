import { NextResponse } from "next/server";
import { isAuthorized } from "@/lib/auth";

export const runtime = "nodejs";

const MAX_PROMPT_LENGTH = 2000;
const MODEL_PATTERN = /^[a-z0-9][a-z0-9._/-]{1,180}(?::[a-zA-Z0-9._-]+)?$/i;

export async function POST(request: Request) {
  if (!(await isAuthorized(request))) {
    return NextResponse.json({ error: "سجّل الدخول أولاً." }, { status: 401 });
  }

  const token = process.env.REPLICATE_API_TOKEN;
  const model = process.env.REPLICATE_VIDEO_MODEL?.trim();
  if (!token || !model) {
    return NextResponse.json(
      { error: "إنشاء الفيديو يحتاج REPLICATE_API_TOKEN وREPLICATE_VIDEO_MODEL." },
      { status: 503 },
    );
  }
  if (!MODEL_PATTERN.test(model) || model.includes("..")) {
    return NextResponse.json({ error: "إعداد نموذج الفيديو غير صالح." }, { status: 503 });
  }

  const body = await request.json().catch(() => null) as
    | { prompt?: unknown; input?: unknown }
    | null;
  if (!body || typeof body.prompt !== "string" || !body.prompt.trim()) {
    return NextResponse.json({ error: "اكتب وصف الفيديو." }, { status: 400 });
  }
  const prompt = body.prompt.trim();
  if (prompt.length > MAX_PROMPT_LENGTH) {
    return NextResponse.json(
      { error: `يجب ألا يتجاوز وصف الفيديو ${MAX_PROMPT_LENGTH} حرف.` },
      { status: 413 },
    );
  }

  // Accept only a plain object for model-specific options. The validated prompt
  // is assigned last so caller-supplied input cannot replace it.
  const extraInput =
    body.input && typeof body.input === "object" && !Array.isArray(body.input)
      ? body.input as Record<string, unknown>
      : {};
  const modelPath = model.replace(":", "/");
  const response = await fetch(
    "https://api.replicate.com/v1/models/" + modelPath + "/predictions",
    {
      method: "POST",
      headers: {
        Authorization: "Bearer " + token,
        "Content-Type": "application/json",
        Prefer: "wait=5",
      },
      body: JSON.stringify({ input: { ...extraInput, prompt } }),
      signal: AbortSignal.timeout(30_000),
      cache: "no-store",
    },
  );

  const data = await response.json().catch(() => null);
  if (!response.ok) {
    return NextResponse.json(
      { error: "تعذر بدء توليد الفيديو لدى مزود الخدمة.", providerStatus: response.status },
      { status: 502 },
    );
  }
  if (!data || typeof data.id !== "string" || typeof data.status !== "string") {
    return NextResponse.json({ error: "استجابة غير صالحة من مزود الفيديو." }, { status: 502 });
  }

  return NextResponse.json({
    id: data.id,
    status: data.status,
    urls: data.urls,
    output: data.output,
  });
}
