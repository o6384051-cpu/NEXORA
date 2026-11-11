import { NextResponse } from "next/server";
import { timingSafeEqual } from "node:crypto";
import { createSession,sessionCookie } from "@/lib/auth";
export const runtime="nodejs";
export async function POST(request:Request){
 const expected=process.env.NEXORA_ADMIN_PASSWORD;
 if(!expected||!process.env.NEXORA_SESSION_SECRET) return NextResponse.json({error:"يلزم إعداد NEXORA_ADMIN_PASSWORD وNEXORA_SESSION_SECRET في إعدادات الاستضافة."},{status:503});
 const body=await request.json().catch(()=>({})) as {password?:unknown};
 if(typeof body.password!=="string")return NextResponse.json({error:"أدخل كلمة المرور."},{status:400});
 const a=Buffer.from(body.password),b=Buffer.from(expected);
 if(a.length!==b.length||!timingSafeEqual(a,b))return NextResponse.json({error:"كلمة المرور غير صحيحة."},{status:401});
 const token=await createSession();const response=NextResponse.json({ok:true});response.headers.set("Set-Cookie",sessionCookie(token));return response;
}
