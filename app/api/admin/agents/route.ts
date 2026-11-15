import { NextResponse } from "next/server";
import { isAuthorized } from "@/lib/auth";
import { getAgentSettings, saveAgentSettings } from "@/lib/agent-settings";
export const runtime = "nodejs";
export async function GET(request: Request) {
  if (!(await isAuthorized(request))) return NextResponse.json({ error: "غير مصرح." }, { status: 401 });
  try { return NextResponse.json(await getAgentSettings()); }
  catch (error) { return NextResponse.json({ error: error instanceof Error ? error.message : "تعذر تحميل الإعدادات." }, { status: 503 }); }
}
export async function PUT(request: Request) {
  if (!(await isAuthorized(request))) return NextResponse.json({ error: "غير مصرح." }, { status: 401 });
  try {
    const body = await request.json();
    if (!body || typeof body !== "object" || typeof body.enabled !== "boolean" || !body.agents || typeof body.agents !== "object") {
      return NextResponse.json({ error: "صيغة إعدادات الوكلاء غير صحيحة." }, { status: 400 });
    }
    return NextResponse.json(await saveAgentSettings(body));
  } catch (error) {
    return NextResponse.json({ error: error instanceof Error ? error.message : "تعذر حفظ الإعدادات." }, { status: 503 });
  }
}
