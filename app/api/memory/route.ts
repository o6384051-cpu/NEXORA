import { NextResponse } from "next/server";
import { isAuthorized } from "@/lib/auth";

export const runtime = "nodejs";
export const maxDuration = 15;

const KEY = "nexora:memory:v1";
type MemoryItem = { id: string; title: string; content: string; category: string; createdAt: string; updatedAt: string };
const allowedCategories = ["personal", "project", "preference", "workflow", "other"] as const;

async function redis(args: unknown[]) {
  const url = process.env.UPSTASH_REDIS_REST_URL;
  const token = process.env.UPSTASH_REDIS_REST_TOKEN;
  if (!url || !token) throw new Error("الذاكرة الدائمة غير مهيأة: اضبط UPSTASH_REDIS_REST_URL وUPSTASH_REDIS_REST_TOKEN.");
  const response = await fetch(url, { method: "POST", headers: { Authorization: "Bearer " + token, "Content-Type": "application/json" }, body: JSON.stringify(args), cache: "no-store", signal: AbortSignal.timeout(8000) });
  const data = await response.json() as { result?: unknown; error?: string };
  if (!response.ok || data.error) throw new Error(data.error || "تعذر الاتصال بمخزن الذاكرة.");
  return data.result;
}
async function readAll(): Promise<MemoryItem[]> {
  const raw = await redis(["GET", KEY]);
  if (typeof raw !== "string" || !raw) return [];
  try {
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? parsed.filter((item) => item && typeof item.id === "string" && typeof item.title === "string" && typeof item.content === "string").slice(0, 100) : [];
  } catch { return []; }
}
export async function GET(request: Request) {
  if (!(await isAuthorized(request))) return NextResponse.json({ error: "غير مصرح." }, { status: 401 });
  try { return NextResponse.json({ memories: await readAll(), configured: true }); }
  catch (error) { return NextResponse.json({ error: error instanceof Error ? error.message : "تعذر تحميل الذاكرة.", configured: false }, { status: 503 }); }
}
export async function POST(request: Request) {
  if (!(await isAuthorized(request))) return NextResponse.json({ error: "غير مصرح." }, { status: 401 });
  let body: { title?: unknown; content?: unknown; category?: unknown };
  try { body = await request.json(); } catch { return NextResponse.json({ error: "بيانات غير صالحة." }, { status: 400 }); }
  if (typeof body.title !== "string" || !body.title.trim() || body.title.length > 120 || typeof body.content !== "string" || !body.content.trim() || body.content.length > 2500 || (body.category !== undefined && !allowedCategories.includes(body.category as typeof allowedCategories[number]))) return NextResponse.json({ error: "العنوان (120 حرفاً) والمحتوى (2500 حرف) مطلوبان، والتصنيف غير صالح." }, { status: 400 });
  try {
    const memories = await readAll();
    const item: MemoryItem = { id: crypto.randomUUID(), title: body.title.trim(), content: body.content.trim(), category: typeof body.category === "string" ? body.category : "other", createdAt: new Date().toISOString(), updatedAt: new Date().toISOString() };
    memories.unshift(item);
    await redis(["SET", KEY, JSON.stringify(memories.slice(0, 100))]);
    return NextResponse.json({ memory: item, count: Math.min(memories.length, 100) }, { status: 201 });
  } catch (error) { return NextResponse.json({ error: error instanceof Error ? error.message : "تعذر حفظ الذاكرة." }, { status: 503 }); }
}
export async function DELETE(request: Request) {
  if (!(await isAuthorized(request))) return NextResponse.json({ error: "غير مصرح." }, { status: 401 });
  const id = new URL(request.url).searchParams.get("id");
  if (!id || id.length > 100) return NextResponse.json({ error: "معرّف الذاكرة مطلوب." }, { status: 400 });
  try {
    const memories = await readAll();
    const updated = memories.filter((item) => item.id !== id);
    if (updated.length === memories.length) return NextResponse.json({ error: "الذاكرة غير موجودة." }, { status: 404 });
    await redis(["SET", KEY, JSON.stringify(updated)]);
    return NextResponse.json({ deleted: true, remaining: updated.length });
  } catch (error) { return NextResponse.json({ error: error instanceof Error ? error.message : "تعذر حذف الذاكرة." }, { status: 503 }); }
}
