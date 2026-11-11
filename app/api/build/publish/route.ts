import { NextResponse } from "next/server";
import { createSign, randomUUID } from "node:crypto";
import { isAuthorized } from "@/lib/auth";
export const runtime="nodejs";
function b64(value:string){return Buffer.from(value).toString("base64url");}
async function getInstallationToken(){
 const appId=process.env.GITHUB_APP_ID,installation=process.env.GITHUB_APP_INSTALLATION_ID,key=process.env.GITHUB_APP_PRIVATE_KEY?.replace(/\\n/g,"\n");
 if(!appId||!installation||!key)throw new Error("إعداد GitHub App غير مكتمل: يلزم App ID وInstallation ID والمفتاح الخاص.");
 const now=Math.floor(Date.now()/1000),head=b64(JSON.stringify({alg:"RS256",typ:"JWT"})),body=b64(JSON.stringify({iat:now-30,exp:now+8*60,iss:appId})),unsigned=head+"."+body;
 const signer=createSign("RSA-SHA256");signer.update(unsigned);signer.end();
 const jwt=unsigned+"."+signer.sign(key,"base64url");
 const response=await fetch("https://api.github.com/app/installations/"+installation+"/access_tokens",{method:"POST",headers:{Authorization:"Bearer "+jwt,Accept:"application/vnd.github+json","X-GitHub-Api-Version":"2022-11-28"}});
 const data=await response.json();if(!response.ok)throw new Error(data.message||"تعذر إصدار رمز GitHub.");
 return data.token as string;
}
export async function POST(request:Request){
 if(!(await isAuthorized(request)))return NextResponse.json({error:"سجّل الدخول أولاً."},{status:401});
 try{
  const body=await request.json() as {repo?:string;name?:string;files?:Array<{path?:string;content?:string}>};
  if(!body.repo||!/^[\w.-]+\/[\w.-]+$/.test(body.repo))return NextResponse.json({error:"اكتب المستودع بصيغة owner/repo."},{status:400});
  if(!Array.isArray(body.files)||body.files.length<1||body.files.length>25)return NextResponse.json({error:"عدد الملفات يجب أن يكون بين 1 و25."},{status:400});
  let total=0;
  for(const file of body.files){
   if(!file.path||typeof file.content!=="string"||file.path.startsWith("/")||file.path.split("/").includes("..")||file.path.includes("\\")||file.path.startsWith(".git/"))return NextResponse.json({error:"توجد بيانات ملف أو مسار غير صالح."},{status:400});
   total+=Buffer.byteLength(file.content,"utf8");
  }
  if(total>500_000)return NextResponse.json({error:"حجم الملفات يتجاوز 500 كيلوبايت."},{status:413});
  const [owner,name]=body.repo.split("/"),token=await getInstallationToken(),baseUrl="https://api.github.com/repos/"+owner+"/"+name;
  const headers={Authorization:"Bearer "+token,Accept:"application/vnd.github+json","X-GitHub-Api-Version":"2022-11-28","Content-Type":"application/json"};
  const repository=await fetch(baseUrl,{headers});const repoData=await repository.json();if(!repository.ok)throw new Error(repoData.message||"تعذر الوصول إلى المستودع. تحقق من تثبيت GitHub App.");
  const base=String(repoData.default_branch||"main");
  const refResponse=await fetch(baseUrl+"/git/ref/heads/"+encodeURIComponent(base),{headers});const refData=await refResponse.json();if(!refResponse.ok)throw new Error(refData.message||"تعذر قراءة الفرع الأساسي.");
  const slug=(body.name||"nexora-generated").toLowerCase().replace(/[^a-z0-9-]+/g,"-").replace(/^-|-$/g,"").slice(0,35)||"nexora-generated";
  const branch="nexora/"+slug+"-"+randomUUID().slice(0,8);
  const created=await fetch(baseUrl+"/git/refs",{method:"POST",headers,body:JSON.stringify({ref:"refs/heads/"+branch,sha:refData.object.sha})});
  const createdData=await created.json();if(!created.ok)throw new Error(createdData.message||"تعذر إنشاء فرع المشروع.");
  const commits=[];
  for(const file of body.files){
   const prior=await fetch(baseUrl+"/contents/"+file.path+"?ref="+encodeURIComponent(branch),{headers});
   const priorData=prior.ok?await prior.json():null;
   const saved=await fetch(baseUrl+"/contents/"+file.path,{method:"PUT",headers,body:JSON.stringify({message:"NEXORA: add "+file.path,content:Buffer.from(file.content!,"utf8").toString("base64"),branch,...(priorData?.sha?{sha:priorData.sha}:{})})});
   const savedData=await saved.json();if(!saved.ok)throw new Error("فشل حفظ "+file.path+": "+(savedData.message||"خطأ GitHub"));
   commits.push({path:file.path,url:savedData.commit?.html_url});
  }
  const pr=await fetch(baseUrl+"/pulls",{method:"POST",headers,body:JSON.stringify({title:"NEXORA: "+(body.name||"Generated project"),head:branch,base,body:"تم إنشاء هذه الملفات بواسطة NEXORA AI. يرجى مراجعتها وتشغيل الاختبارات قبل الدمج. لم يتم دمجها تلقائياً."})});
  const prData=await pr.json();if(!pr.ok)throw new Error(prData.message||"تم رفع الملفات لكن تعذر فتح Pull Request.");
  return NextResponse.json({ok:true,branch,pullRequest:prData.html_url,number:prData.number,commits});
 }catch(error){return NextResponse.json({error:error instanceof Error?error.message:"تعذر نشر ملفات المشروع إلى GitHub."},{status:502});}
}
