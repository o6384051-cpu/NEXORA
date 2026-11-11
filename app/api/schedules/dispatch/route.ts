import { NextResponse } from "next/server";
import { runAgentTeam } from "@/lib/agents/registry";
export const runtime="nodejs";
async function command(args:unknown[]) { const url=process.env.UPSTASH_REDIS_REST_URL,token=process.env.UPSTASH_REDIS_REST_TOKEN; if(!url||!token) throw new Error("مخزن المهام غير مضبوط."); const r=await fetch(url,{method:"POST",headers:{Authorization:"Bearer "+token,"Content-Type":"application/json"},body:JSON.stringify(args),cache:"no-store"}); const d=await r.json(); if(!r.ok||d.error) throw new Error(d.error||"فشل أمر Redis."); return d.result; }
export async function GET(request:Request) {
 const secret=process.env.CRON_SECRET;
 if(!secret || request.headers.get("authorization")!=="Bearer "+secret) return NextResponse.json({error:"غير مصرح."},{status:401});
 try {
  const rows=await command(["LRANGE","nexora:schedules","0","99"]) as string[];
  const due=(rows||[]).map(raw=>({raw,item:JSON.parse(raw) as {id:string;task:string;runAt:string;cadence:string;status:string}})).filter(x=>x.item.status==="scheduled"&&new Date(x.item.runAt)<=new Date());
  const processed: Array<{id:string;status:string;review:string;searchStatus:string}> = [];
  for(const entry of due){
   const result=await runAgentTeam(entry.item.task);
   await command(["LREM","nexora:schedules","1",entry.raw]);
   const status=result.executionStatus==="analysis_completed"?"analysis_completed":"partially_completed";\n   const history={id:entry.item.id,task:entry.item.task,completedAt:new Date().toISOString(),status,searchStatus:result.searchStatus,executionNote:result.executionNote,result};
   await command(["LPUSH","nexora:schedule-history",JSON.stringify(history)]);
   if(entry.item.cadence==="daily"||entry.item.cadence==="weekly"){
    const next=new Date(entry.item.runAt); next.setDate(next.getDate()+(entry.item.cadence==="daily"?1:7));
    await command(["LPUSH","nexora:schedules",JSON.stringify({...entry.item,runAt:next.toISOString()})]);
   }
   processed.push({id:entry.item.id,status,review:result.review,searchStatus:result.searchStatus});
  }
  return NextResponse.json({processed:processed.length,results:processed,note:"تعني analysis_completed اكتمال مراحل التحليل النصي فقط، ولا تعني تشغيل كود أو نشر تطبيق."});
 } catch(e) { return NextResponse.json({error:e instanceof Error?e.message:"تعذر تنفيذ المهام المستحقة."},{status:503}); }
}
