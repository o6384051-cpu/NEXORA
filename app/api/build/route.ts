import { NextResponse } from "next/server";
import { isAuthorized } from "@/lib/auth";
import { generateText } from "@/lib/ai/providers";
export const runtime="nodejs";
export async function POST(request:Request){
 if(!(await isAuthorized(request))) return NextResponse.json({error:"سجّل الدخول أولاً من صفحة المسؤول."},{status:401});
 const body=await request.json().catch(()=>({})) as {description?:unknown;kind?:string;provider?:string};
 if(typeof body.description!=="string"||!body.description.trim()) return NextResponse.json({error:"صف التطبيق أو الموقع الذي تريد بناءه."},{status:400});
 if(body.description.length>10000) return NextResponse.json({error:"الوصف طويل جداً."},{status:413});
 const prompt="أنشئ هيكل مشروع أولي قابل للتطوير حسب الوصف التالي. أعد JSON صالحاً فقط بالشكل {name,summary,files:[{path,content}],runInstructions}. اجعل الملفات محدودة ومترابطة، واستخدم ممارسات أمان جيدة، ولا تضع مفاتيح أو أسرار. لا تدّع اختباراً أو نشراً. نوع المشروع: "+(body.kind||"web")+"\nالوصف: "+body.description;
 try{
  const raw=await generateText([{role:"system",content:"أنت مهندس برمجيات يبني نماذج أولية. أخرج JSON فقط دون Markdown."},{role:"user",content:prompt}],body.provider);
  const clean=raw.trim().replace(/^\x60\x60\x60(?:json)?\s*/i,"").replace(/\s*\x60\x60\x60$/,"");
  const result=JSON.parse(clean) as {name?:string;summary?:string;files?:Array<{path:string;content:string}>;runInstructions?:string};
  if(!Array.isArray(result.files)||result.files.length>30||result.files.some(f=>!f.path||f.path.startsWith("/")||f.path.includes("..")||typeof f.content!=="string")) return NextResponse.json({error:"أعاد النموذج بنية ملفات غير صالحة."},{status:502});
  return NextResponse.json({...result,notice:"هذه ملفات مولدة أولياً ولم يتم تشغيلها أو اختبارها أو نشرها. راجعها قبل الاستخدام."});
 }catch(e){return NextResponse.json({error:e instanceof Error?e.message:"تعذر توليد ملفات المشروع."},{status:502});}
}
