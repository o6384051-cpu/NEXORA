import { NextResponse } from "next/server";
export const runtime="nodejs";
export async function GET(request:Request) {
 const secret=process.env.CRON_SECRET;
 if(!secret || request.headers.get("authorization")!=="Bearer "+secret) return NextResponse.json({error:"غير مصرح."},{status:401});
 const url=process.env.UPSTASH_REDIS_REST_URL,token=process.env.UPSTASH_REDIS_REST_TOKEN;
 if(!url||!token) return NextResponse.json({error:"مخزن المهام غير مضبوط."},{status:503});
 const r=await fetch(url,{method:"POST",headers:{Authorization:"Bearer "+token,"Content-Type":"application/json"},body:JSON.stringify(["LRANGE","nexora:schedules","0","99"])});
 const data=await r.json(); const due=(data.result||[]).map((x:string)=>JSON.parse(x)).filter((x:{runAt:string;status:string})=>x.status==="scheduled"&&new Date(x.runAt)<=new Date());
 return NextResponse.json({dueCount:due.length,dueTasks:due,notice:"تم تحديد المهام المستحقة فقط. يلزم ربط منفذ آمن لتشغيلها وتحديث حالتها."});
}
