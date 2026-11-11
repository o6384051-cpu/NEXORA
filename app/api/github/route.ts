import { NextResponse } from "next/server";
import { createSign } from "node:crypto";
import { isAuthorized } from "@/lib/auth";
export const runtime="nodejs";
function b64(value:string){return Buffer.from(value).toString("base64url");}
async function installationToken(){
 const appId=process.env.GITHUB_APP_ID,installation=process.env.GITHUB_APP_INSTALLATION_ID,key=process.env.GITHUB_APP_PRIVATE_KEY?.replace(/\\n/g,"\n");
 if(!appId||!installation||!key) throw new Error("إعداد GitHub App غير مكتمل.");
 const now=Math.floor(Date.now()/1000),header=b64(JSON.stringify({alg:"RS256",typ:"JWT"})),payload=b64(JSON.stringify({iat:now-30,exp:now+8*60,iss:appId})),unsigned=header+"."+payload;
 const signer=createSign("RSA-SHA256");signer.update(unsigned);signer.end();const jwt=unsigned+"."+signer.sign(key,"base64url");
 const response=await fetch("https://api.github.com/app/installations/"+installation+"/access_tokens",{method:"POST",headers:{Authorization:"Bearer "+jwt,Accept:"application/vnd.github+json","X-GitHub-Api-Version":"2022-11-28"}});
 const data=await response.json();if(!response.ok)throw new Error(data.message||"تعذر إصدار رمز تثبيت GitHub App.");return data.token as string;
}
export async function GET(){return NextResponse.json({configured:Boolean(process.env.GITHUB_APP_ID&&process.env.GITHUB_APP_PRIVATE_KEY&&process.env.GITHUB_APP_INSTALLATION_ID),mode:"github-app",capabilities:["create_branch","commit_file","create_pr"],status:"credentials_required_until_configured"});}
export async function POST(request:Request){
 if(!(await isAuthorized(request)))return NextResponse.json({error:"سجّل الدخول أولاً."},{status:401});
 try{
  const body=await request.json() as {action?:string;repo?:string;branch?:string;base?:string;path?:string;content?:string;message?:string;title?:string;head?:string};
  if(!body.repo||!/^[\w.-]+\/[\w.-]+$/.test(body.repo))return NextResponse.json({error:"حدد المستودع بصيغة owner/repo."},{status:400});
  const [owner,name]=body.repo.split("/"),token=await installationToken(),baseUrl="https://api.github.com/repos/"+owner+"/"+name;
  const headers={Authorization:"Bearer "+token,Accept:"application/vnd.github+json","X-GitHub-Api-Version":"2022-11-28","Content-Type":"application/json"};
  if(body.action==="create_branch"){
   if(!body.branch||!body.base)return NextResponse.json({error:"حدد اسم الفرع والفرع الأساسي."},{status:400});
   const ref=await fetch(baseUrl+"/git/ref/heads/"+encodeURIComponent(body.base),{headers});const data=await ref.json();if(!ref.ok)throw new Error(data.message||"تعذر قراءة الفرع الأساسي.");
   const created=await fetch(baseUrl+"/git/refs",{method:"POST",headers,body:JSON.stringify({ref:"refs/heads/"+body.branch,sha:data.object.sha})});const result=await created.json();if(!created.ok)throw new Error(result.message||"تعذر إنشاء الفرع.");return NextResponse.json({branch:result.ref,sha:result.object.sha});
  }
  if(body.action==="commit_file"){
   if(!body.branch||!body.path||typeof body.content!=="string"||!body.message)return NextResponse.json({error:"يلزم الفرع والمسار والمحتوى ورسالة الالتزام."},{status:400});
   if(body.path.startsWith("/")||body.path.split("/").includes(".."))return NextResponse.json({error:"مسار الملف غير مسموح."},{status:400});
   const prior=await fetch(baseUrl+"/contents/"+body.path+"?ref="+encodeURIComponent(body.branch),{headers});
   const priorData=prior.ok?await prior.json():null;
   const saved=await fetch(baseUrl+"/contents/"+body.path,{method:"PUT",headers,body:JSON.stringify({message:body.message,content:Buffer.from(body.content).toString("base64"),branch:body.branch,...(priorData?.sha?{sha:priorData.sha}:{})})});
   const result=await saved.json();if(!saved.ok)throw new Error(result.message||"تعذر حفظ الملف في GitHub.");return NextResponse.json({path:body.path,commit:result.commit?.html_url});
  }
  if(body.action==="create_pr"){
   if(!body.head||!body.base||!body.title)return NextResponse.json({error:"يلزم عنوان وhead وbase."},{status:400});
   const created=await fetch(baseUrl+"/pulls",{method:"POST",headers,body:JSON.stringify({title:body.title,head:body.head,base:body.base,body:body.message||"Created by NEXORA AI"})});const result=await created.json();if(!created.ok)throw new Error(result.message||"تعذر فتح Pull Request.");return NextResponse.json({number:result.number,url:result.html_url});
  }
  return NextResponse.json({error:"الإجراء غير معروف."},{status:400});
 }catch(error){return NextResponse.json({error:error instanceof Error?error.message:"فشل تكامل GitHub."},{status:502});}
}
