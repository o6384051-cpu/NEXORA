import { NextResponse } from "next/server";
import { isAuthorized } from "@/lib/auth";

export const runtime = "nodejs";
const QUEUE = "nexora:tasks:pending";
const PREFIX = "nexora:task:";
async function redis(args: unknown[]) {
  const url = process.env.UPSTASH_REDIS_REST_URL, token = process.env.UPSTASH_REDIS_REST_TOKEN;
  if (!url || !token) throw new Error("طابور المهام يحتاج إعداد Upstash Redis.");
  const response = await fetch(url, { method: "POST", headers: { Authorization: "Bearer " + token, "Content-Type": "application/json" }, body: JSON.stringify(args), cache: "no-store", signal: AbortSignal.timeout(8000) });
  const data = await response.json() as { result?: unknown; error?: string };
  if (!response.ok || data.error) throw new Error(data.error || "تعذر الوصول إلى طابور المهام.");
  return data.result;
}
type TaskRecord = { id: string; task: string; status: "queued" | "running" | "completed" | "partially_completed" | "failed" | "cancelled"; attempts: number; maxAttempts: number; createdAt: string; updatedAt: string; startedAt?: string; completedAt?: string; result?: unknown; error?: string };
export async function GET(request: Request) {
  if (!(await isAuthorized(request))) return NextResponse.json({ error: "غير مصرح." }, { status: 401 });
  try {
    const ids = await redis(["LRANGE", QUEUE, "0", "49"]) as string[];
    const tasks = await Promise.all((ids || []).map(async (id) => {
      const raw = await redis(["GET", PREFIX + id]);
      if (typeof raw !== "string") return null;
      try { const item = JSON.parse(raw) as TaskRecord; return { id: item.id, task: item.task, status: item.status, attempts: item.attempts, createdAt: item.createdAt, updatedAt: item.updatedAt, error: item.error }; } catch { return null; }
    }));
    return NextResponse.json({ tasks: tasks.filter(Boolean) });
  } catch (error) { return NextResponse.json({ error: error instanceof Error ? error.message : "تعذر قراءة المهام." }, { status: 503 }); }
}
export async function POST(request: Request) {
  if (!(await isAuthorized(request))) return NextResponse.json({ error: "غير مصرح." }, { status: 401 });
  let body: { task?: unknown };
  try { body = await request.json(); } catch { return NextResponse.json({ error: "صيغة الطلب غير صالحة." }, { status: 400 }); }
  if (typeof body.task !== "string" || !body.task.trim() || body.task.length > 12000) return NextResponse.json({ error: "اكتب مهمة لا تتجاوز 12000 حرف." }, { status: 400 });
  try {
    const now = new Date().toISOString(), id = crypto.randomUUID();
    const item: TaskRecord = { id, task: body.task.trim(), status: "queued", attempts: 0, maxAttempts: 3, createdAt: now, updatedAt: now };
    await redis(["SET", PREFIX + id, JSON.stringify(item)]);
    await redis(["LPUSH", QUEUE, id]);
    return NextResponse.json({ task: item, message: "حُفظت المهمة في الطابور وستُنفذ عند تشغيل العامل." }, { status: 202 });
  } catch (error) { return NextResponse.json({ error: error instanceof Error ? error.message : "تعذر حفظ المهمة." }, { status: 503 }); }
}
