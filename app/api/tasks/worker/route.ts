import { NextResponse } from "next/server";
import { runAgentTeam } from "@/lib/agents/registry";
import { getAgentSettings, getEnabledAgentIds } from "@/lib/agent-settings";
export const runtime = "nodejs";
export const maxDuration = 60;
const PENDING = "nexora:tasks:pending", PROCESSING = "nexora:tasks:processing", PREFIX = "nexora:task:";
async function redis(args: unknown[]) {
  const url = process.env.UPSTASH_REDIS_REST_URL, token = process.env.UPSTASH_REDIS_REST_TOKEN;
  if (!url || !token) throw new Error("مخزن المهام غير مضبوط.");
  const response = await fetch(url, { method: "POST", headers: { Authorization: "Bearer " + token, "Content-Type": "application/json" }, body: JSON.stringify(args), cache: "no-store", signal: AbortSignal.timeout(8000) });
  const data = await response.json() as { result?: unknown; error?: string };
  if (!response.ok || data.error) throw new Error(data.error || "فشل أمر Redis.");
  return data.result;
}
type TaskRecord = { id: string; task: string; status: string; attempts: number; maxAttempts: number; createdAt: string; updatedAt: string; startedAt?: string; completedAt?: string; result?: unknown; error?: string };
export async function GET(request: Request) {
  const secret = process.env.CRON_SECRET;
  if (!secret || request.headers.get("authorization") !== "Bearer " + secret) return NextResponse.json({ error: "غير مصرح." }, { status: 401 });
  try {
    const inflight = await redis(["LRANGE", PROCESSING, "0", "49"]) as string[];
    for (const id of inflight || []) {
      const raw = await redis(["GET", PREFIX + id]);
      if (typeof raw !== "string") { await redis(["LREM", PROCESSING, "1", id]); continue; }
      const item = JSON.parse(raw) as TaskRecord;
      const stale = item.status !== "running" || !item.startedAt || Date.now() - Date.parse(item.startedAt) > 5 * 60_000;
      if (stale) {
        item.status = "queued"; item.updatedAt = new Date().toISOString(); item.error = "تمت استعادة المهمة بعد انقطاع العامل.";
        await redis(["SET", PREFIX + id, JSON.stringify(item)]);
        await redis(["LREM", PROCESSING, "1", id]);
        await redis(["LPUSH", PENDING, id]);
      }
    }
    const id = await redis(["RPOPLPUSH", PENDING, PROCESSING]) as string | null;
    if (!id) return NextResponse.json({ processed: false, message: "لا توجد مهام في الانتظار." });
    const raw = await redis(["GET", PREFIX + id]);
    if (typeof raw !== "string") { await redis(["LREM", PROCESSING, "1", id]); return NextResponse.json({ processed: false, error: "سجل المهمة غير موجود." }, { status: 404 }); }
    const item = JSON.parse(raw) as TaskRecord;
    if (["completed", "partially_completed", "cancelled", "failed"].includes(item.status)) {
      await redis(["LREM", PROCESSING, "1", id]);
      return NextResponse.json({ processed: false, message: "تم تجاهل مهمة نهائية." });
    }
    item.status = "running"; item.attempts = (item.attempts || 0) + 1; item.startedAt = new Date().toISOString(); item.updatedAt = item.startedAt;
    await redis(["SET", PREFIX + id, JSON.stringify(item)]);
    try {
      const settings = await getAgentSettings();
      const result = await runAgentTeam(item.task, undefined, getEnabledAgentIds(settings.settings));
      item.result = result; item.status = result.executionStatus === "analysis_completed" ? "completed" : "partially_completed";
      item.completedAt = new Date().toISOString(); item.updatedAt = item.completedAt; delete item.error;
      await redis(["SET", PREFIX + id, JSON.stringify(item)]);
      await redis(["LREM", PROCESSING, "1", id]);
      await redis(["LPUSH", "nexora:tasks:history", id]);
      return NextResponse.json({ processed: true, id, status: item.status, attempts: item.attempts });
    } catch (error) {
      item.error = error instanceof Error ? error.message : "تعذر تنفيذ المهمة.";
      item.status = item.attempts < item.maxAttempts ? "queued" : "failed";
      item.updatedAt = new Date().toISOString();
      if (item.status === "failed") item.completedAt = item.updatedAt;
      await redis(["SET", PREFIX + id, JSON.stringify(item)]);
      await redis(["LREM", PROCESSING, "1", id]);
      if (item.status === "queued") await redis(["LPUSH", PENDING, id]);
      else await redis(["LPUSH", "nexora:tasks:history", id]);
      return NextResponse.json({ processed: true, id, status: item.status, attempts: item.attempts, error: item.error });
    }
  } catch (error) { return NextResponse.json({ error: error instanceof Error ? error.message : "تعذر تشغيل عامل المهام." }, { status: 503 }); }
}
