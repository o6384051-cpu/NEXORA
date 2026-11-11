import { NextResponse } from "next/server";
import { isAuthorized } from "@/lib/auth";

export const runtime = "nodejs";

type MemoryRecord = {
  id: string;
  title: string;
  content: string;
  category: "preference" | "project" | "fact" | "note";
  createdAt: string;
  updatedAt: string;
};

const KEY = "nexora:memory:v1";
const MAX_TITLE = 120;
const MAX_CONTENT = 4000;

async function redis(args: unknown[]) {
  const url = process.env.UPSTASH_REDIS_REST_URL;
  const token = process.env.UPSTASH_REDIS_REST_TOKEN;
  if (!url || !token) throw new Error("الذاكرة الدائمة تحتاج إعداد UPSTASH_REDIS_REST_URL وUPSTASH_REDIS_REST_TOKEN.");
  const response = await fetch(url, {
    method: "POST",
    headers: { Authorization: "Bearer " + token, "Content-Type": "application/json" },
    body: JSON.stringify(args),
    cache: "no-store",
    signal: AbortSignal.timeout(8000),
  });
  const data = await response.json().catch(() => null) as { result?: unknown; error?: string } | null;
  if (!response.ok || !data || data.error) throw new Error("تعذر الوصول إلى مخزن الذاكرة الدائمة.");
  return data.result;
}

function safeRecord(value: unknown): MemoryRecord | null {
  if (typeof value !== "string") return null;
  try {
    const item = JSON.parse(value) as Partial<MemoryRecord>;
    if (
      typeof item.id !== "string" ||
      typeof item.title !== "string" ||
      typeof item.content !== "string" ||
      typeof item.createdAt !== "string" ||
      typeof item.updatedAt !== "string" ||
      !["preference", "project", "fact", "note"].includes(String(item.category))
    ) return null;
    return item as MemoryRecord;
  } catch {
    return null;
  }
}

export async function GET(request: Request) {
  if (!(await isAuthorized(request))) {
    return NextResponse.json({ error: "سجّل الدخول أولاً." }, { status: 401 });
  }
  try {
    const raw = await redis(["HGETALL", KEY]);
    const records: MemoryRecord[] = [];
    const values: unknown[] = [];
    if (Array.isArray(raw)) {
      // Upstash REST may return Redis HGETALL as alternating field/value pairs.
      for (let index = 1; index < raw.length; index += 2) values.push(raw[index]);
    } else if (raw && typeof raw === "object") {
      values.push(...Object.values(raw as Record<string, unknown>));
    }
    for (const value of values) {
      const record = safeRecord(value);
      if (record) records.push(record);
    }
    records.sort((a, b) => b.updatedAt.localeCompare(a.updatedAt));
    return NextResponse.json({ memories: records, count: records.length, persistent: true });
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "تعذر قراءة الذاكرة.", persistent: false },
      { status: 503 },
    );
  }
}

export async function POST(request: Request) {
  if (!(await isAuthorized(request))) {
    return NextResponse.json({ error: "سجّل الدخول أولاً." }, { status: 401 });
  }
  const body = await request.json().catch(() => null) as
    | { title?: unknown; content?: unknown; category?: unknown; id?: unknown }
    | null;
  if (!body || typeof body.title !== "string" || typeof body.content !== "string") {
    return NextResponse.json({ error: "أدخل عنوان الذاكرة ومحتواها." }, { status: 400 });
  }
  const title = body.title.trim();
  const content = body.content.trim();
  if (!title || !content) return NextResponse.json({ error: "العنوان والمحتوى مطلوبان." }, { status: 400 });
  if (title.length > MAX_TITLE || content.length > MAX_CONTENT) {
    return NextResponse.json({ error: "الحد الأقصى 120 حرفاً للعنوان و4000 حرف للمحتوى." }, { status: 413 });
  }
  const category = ["preference", "project", "fact", "note"].includes(String(body.category))
    ? body.category as MemoryRecord["category"]
    : "note";
  try {
    const id = typeof body.id === "string" && /^[a-f0-9-]{36}$/i.test(body.id)
      ? body.id
      : crypto.randomUUID();
    const now = new Date().toISOString();
    const record: MemoryRecord = { id, title, content, category, createdAt: now, updatedAt: now };
    await redis(["HSET", KEY, id, JSON.stringify(record)]);
    return NextResponse.json({ memory: record, saved: true }, { status: 201 });
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "تعذر حفظ الذاكرة." },
      { status: 503 },
    );
  }
}

export async function DELETE(request: Request) {
  if (!(await isAuthorized(request))) {
    return NextResponse.json({ error: "سجّل الدخول أولاً." }, { status: 401 });
  }
  const body = await request.json().catch(() => null) as { id?: unknown } | null;
  if (!body || typeof body.id !== "string" || !/^[a-f0-9-]{36}$/i.test(body.id)) {
    return NextResponse.json({ error: "معرّف الذاكرة غير صالح." }, { status: 400 });
  }
  try {
    const deleted = await redis(["HDEL", KEY, body.id]);
    return NextResponse.json({ deleted: Number(deleted) === 1 });
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "تعذر حذف الذاكرة." },
      { status: 503 },
    );
  }
}
