import { NextResponse } from "next/server";
import { isAuthorized } from "@/lib/auth";
export const runtime="nodejs";
export async function GET(request:Request,{params}:{params:Promise<{id:string}>}) {
 if(!(await isAuthorized(request))) return NextResponse.json({error:"سجّل الدخول أولاً."},{status:401});
 const token=process.env.REPLICATE_API_TOKEN;
 if(!token) return NextResponse.json({error:"REPLICATE_API_TOKEN غير مضبوط."},{status:503});
 const {id}=await params;
 const response=await fetch("https://api.replicate.com/v1/predictions/"+encodeURIComponent(id),{headers:{"Authorization":"Bearer "+token},cache:"no-store"});
 const data=await response.json();
 if(!response.ok) return NextResponse.json({error:"تعذر جلب حالة الفيديو."},{status:502});
 return NextResponse.json({id:data.id,status:data.status,output:data.output,error:data.error});
}
