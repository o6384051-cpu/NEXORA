import { NextResponse } from "next/server";
export const runtime="nodejs";
export async function POST(){
 const key=process.env.OPENAI_API_KEY;
 if(!key) return NextResponse.json({error:"المحادثة الصوتية المباشرة تحتاج OPENAI_API_KEY."},{status:503});
 const response=await fetch("https://api.openai.com/v1/realtime/client_secrets",{method:"POST",headers:{Authorization:"Bearer "+key,"Content-Type":"application/json"},body:JSON.stringify({session:{type:"realtime",model:process.env.OPENAI_REALTIME_MODEL||"gpt-realtime",audio:{output:{voice:"marin"}}})},signal:AbortSignal.timeout(20000)});
 const data=await response.json();
 if(!response.ok) return NextResponse.json({error:data?.error?.message||"تعذر إنشاء جلسة صوتية."},{status:502});
 return NextResponse.json({client_secret:data.value||data.client_secret?.value,expires_at:data.expires_at});
}
