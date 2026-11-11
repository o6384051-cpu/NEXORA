import { NextResponse } from "next/server";
import { isAuthorized } from "@/lib/auth";
export const runtime="nodejs";
export async function POST(request:Request) {
 if(!(await isAuthorized(request))) return NextResponse.json({error:"سجّل الدخول أولاً من صفحة المسؤول."},{status:401});
 const token=process.env.VERCEL_TOKEN;
 if(!token) return NextResponse.json({error:"النشر التلقائي يحتاج VERCEL_TOKEN وربط مستودع GitHub."},{status:503});
 const body=await request.json().catch(()=>({})) as {name?:string;repo?:string;ref?:string};
 if(!body.name||!body.repo) return NextResponse.json({error:"حدد اسم المشروع ومستودع GitHub بصيغة owner/repo."},{status:400});
 const [owner,repo]=body.repo.split("/");
 if(!owner||!repo) return NextResponse.json({error:"صيغة المستودع غير صحيحة."},{status:400});
 const response=await fetch("https://api.vercel.com/v13/deployments",{method:"POST",headers:{Authorization:"Bearer "+token,"Content-Type":"application/json"},body:JSON.stringify({name:body.name,gitSource:{type:"github",org:owner,repo,ref:body.ref||"main"}}),signal:AbortSignal.timeout(30000)});
 const data=await response.json();
 if(!response.ok) return NextResponse.json({error:data.error?.message||"فشل إنشاء النشر. تحقق من ربط GitHub وصلاحيات Vercel."},{status:502});
 return NextResponse.json({id:data.id,url:data.url,state:data.readyState||data.status});
}
