import { NextResponse } from "next/server";
import { isAuthorized } from "@/lib/auth";

export const runtime = "nodejs";

export async function POST(request: Request) {
  if (!(await isAuthorized(request))) {
    return NextResponse.json({ error: "سجّل الدخول أولاً." }, { status: 401 });
  }

  const token = process.env.REPLICATE_API_TOKEN;
  if (!token) {
    return NextResponse.json({ error: "REPLICATE_API_TOKEN غير مضبوط في إعدادات الخادم." }, { status: 503 });
  }

  const body = await request.json().catch(() => ({})) as { prompt?: unknown };
  if (typeof body.prompt !== "string" || !body.prompt.trim()) {
    return NextResponse.json({ error: "اكتب وصف الصورة." }, { status: 400 });
  }
  if (body.prompt.length > 4000) {
    return NextResponse.json({ error: "وصف الصورة طويل جداً؛ الحد الأقصى 4000 حرف." }, { status: 400 });
  }

  const model = (process.env.REPLICATE_IMAGE_MODEL || "black-forest-labs/flux-schnell").trim();
  const response = await fetch("https://api.replicate.com/v1/models/" + model + "/predictions", {
    method: "POST",
    headers: {
      Authorization: "Bearer " + token,
      "Content-Type": "application/json",
      Prefer: "wait=20"
    },
    body: JSON.stringify({ input: { prompt: body.prompt.trim(), num_outputs: 1, aspect_ratio: "1:1", output_format: "webp" } }),
    signal: AbortSignal.timeout(60000)
  });

  const data = await response.json().catch(() => ({}));
  if (!response.ok) {
    return NextResponse.json({ error: data?.detail || "تعذر إنشاء الصورة عبر Replicate." }, { status: 502 });
  }

  return NextResponse.json({ id: data.id, status: data.status, output: data.output, urls: data.urls });
}
