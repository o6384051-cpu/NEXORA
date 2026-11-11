import { NextResponse } from "next/server";
export const runtime="nodejs";
export async function POST(request:Request) {
 const actionSecret=process.env.NEXORA_ACTION_SECRET;
 if(!actionSecret || request.headers.get("authorization")!=="Bearer "+actionSecret) return NextResponse.json({error:"يتطلب إنشاء الفيديو جلسة مستخدم موثقة."},{status:401});
 const token=process.env.REPLICATE_API_TOKEN, model=process.env.REPLICATE_VIDEO_MODEL;
 if(!token || !model) return NextResponse.json({error:"إنشاء الفيديو يحتاج REPLICATE_API_TOKEN وREPLICATE_VIDEO_MODEL، وهما غير مضبوطين بعد."},{status:503});
 const body=await request.json().catch(()=>({})) as {prompt?:unknown;input?:Record<string,unknown>};
 if(typeof body.prompt!=="string" || !body.prompt.trim()) return NextResponse.json({error:"اكتب وصف الفيديو."},{status:400});
 const response=await fetch("https://api.replicate.com/v1/models/"+model.replace(":","/")+"/predictions",{method:"POST",headers:{"Authorization":"Bearer "+token,"Content-Type":"application/json","Prefer":"wait=5"},body:JSON.stringify({input:{prompt:body.prompt,...(body.input||{})}}),signal:AbortSignal.timeout(30000)});
 const data=await response.json();
 if(!response.ok) return NextResponse.json({error:data?.detail||"تعذر بدء توليد الفيديو."},{status:502});
 return NextResponse.json({id:data.id,status:data.status,urls:data.urls,output:data.output});
}
