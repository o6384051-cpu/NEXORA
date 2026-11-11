import { NextResponse } from "next/server";
import { runAgentTeam } from "@/lib/agents/registry";
export const runtime="nodejs";
export async function POST(request:Request) {
 try {
  const body=await request.json() as {task?:unknown;provider?:string};
  if(typeof body.task!=="string" || !body.task.trim()) return NextResponse.json({error:"اكتب المهمة أولاً."},{status:400});
  if(body.task.length>12000) return NextResponse.json({error:"المهمة طويلة جداً."},{status:413});
  const result=await runAgentTeam(body.task.trim(),body.provider);
  return NextResponse.json(result);
 } catch(error) { return NextResponse.json({error:error instanceof Error?error.message:"تعذر تشغيل فريق الوكلاء."},{status:503}); }
}
