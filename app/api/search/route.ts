import { NextResponse } from "next/server";
export const runtime="nodejs";
export async function POST(request:Request) {
 const body=await request.json().catch(()=>({})) as {query?:unknown};
 if(typeof body.query!=="string" || !body.query.trim()) return NextResponse.json({error:"أدخل عبارة البحث."},{status:400});
 const key=process.env.TAVILY_API_KEY;
 if(!key) return NextResponse.json({error:"البحث المستقل يحتاج TAVILY_API_KEY. لم يتم إعداد مفتاح البحث بعد."},{status:503});
 const response=await fetch("https://api.tavily.com/search",{method:"POST",headers:{"Content-Type":"application/json"},body:JSON.stringify({api_key:key,query:body.query.trim(),search_depth:"advanced",max_results:8,include_answer:true}),signal:AbortSignal.timeout(30000),cache:"no-store"});
 const data=await response.json();
 if(!response.ok) return NextResponse.json({error:"فشل مزود البحث."},{status:502});
 return NextResponse.json({answer:data.answer||"",results:(data.results||[]).map((r:{title:string;url:string;content:string;score:number})=>({title:r.title,url:r.url,content:r.content,score:r.score}))});
}
