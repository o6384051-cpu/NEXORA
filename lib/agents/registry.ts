import { generateText } from "@/lib/ai/providers";
export const agentRoles = [
 { id:"planner", name:"وكيل التخطيط", instruction:"حلل الهدف وقسمه إلى مراحل مرتبة ومخرجات قابلة للتحقق." },
 { id:"researcher", name:"وكيل البحث", instruction:"حلل المصادر الفعلية المرفقة، وميّز الحقائق عن الاستنتاجات." },
 { id:"engineer", name:"وكيل الهندسة والبرمجة", instruction:"اقترح بنية تقنية وكوداً آمناً قابلاً للاختبار." },
 { id:"reviewer", name:"وكيل المراجعة والجودة", instruction:"راجع الخطة والمخرجات واكتشف المخاطر والنواقص." },
 { id:"operator", name:"وكيل التنفيذ", instruction:"حوّل الخطة إلى إجراءات عملية، وحدد بدقة ما نفذته الأدوات وما يحتاج موافقة." },
] as const;

type SearchResult={title:string;url:string;content:string;score:number};
async function researchWeb(task:string):Promise<{answer:string;sources:SearchResult[];status:string}>{
 const key=process.env.TAVILY_API_KEY;
 if(!key)return {answer:"البحث الحي غير متاح: أضف TAVILY_API_KEY إلى إعدادات الخادم.",sources:[],status:"not_configured"};
 const response=await fetch("https://api.tavily.com/search",{method:"POST",headers:{"Content-Type":"application/json"},body:JSON.stringify({api_key:key,query:task,search_depth:"advanced",max_results:6,include_answer:true}),signal:AbortSignal.timeout(25000),cache:"no-store"});
 const data=await response.json();
 if(!response.ok)throw new Error("تعذر البحث عبر Tavily.");
 const sources=(data.results||[]).map((r:{title?:string;url?:string;content?:string;score?:number})=>({title:r.title||"مصدر",url:r.url||"",content:r.content||"",score:r.score||0})).filter((r:SearchResult)=>r.url);
 return {answer:String(data.answer||""),sources,status:"completed"};
}

export async function runAgentTeam(task:string, provider?:string) {
 const plan = await generateText([{role:"system",content:agentRoles[0].instruction},{role:"user",content:task}],provider);
 const webResearch=await researchWeb(task);
 const research = await generateText([
  {role:"system",content:agentRoles[1].instruction+" لا تختلق أي مصدر أو معلومة. إذا كانت النتائج غير كافية فقل ذلك صراحة."},
  {role:"user",content:task+"\nخطة التخطيط:\n"+plan+"\nملخص محرك البحث:\n"+webResearch.answer+"\nالمصادر والنتائج:\n"+webResearch.sources.map((s,i)=>"["+i+"] "+s.title+" | "+s.url+"\n"+s.content).join("\n\n")}
 ],provider);
 const engineering = await generateText([{role:"system",content:agentRoles[2].instruction},{role:"user",content:task+"\nالخطة:\n"+plan+"\nملاحظات البحث المدعومة بالمصادر:\n"+research}],provider);
 const review = await generateText([{role:"system",content:agentRoles[3].instruction},{role:"user",content:"راجع المخرجات التالية للمهمة: "+task+"\n"+engineering}],provider);
 const operator = await generateText([{role:"system",content:agentRoles[4].instruction+" لا تدّع إنشاء ملفات أو تعديل GitHub أو نشر تطبيق. هذه المرحلة تنفذ البحث والتحليل فقط."},{role:"user",content:"المهمة: "+task+"\nالخطة: "+plan+"\nالمخرجات الهندسية: "+engineering+"\nالمراجعة: "+review}],provider);
 return { agents: agentRoles.map(a=>({id:a.id,name:a.name,status:a.id==="researcher"&&webResearch.status!=="completed"?"waiting_for_configuration":"completed"})), plan, research, engineering, review, operator, searchStatus:webResearch.status, searchSources:webResearch.sources, executionNote:"تم ربط وكيل البحث بمحرك Tavily عند إعداد مفتاحه. تنفيذ تغييرات GitHub والنشر يحتاج خطوة نشر مستقلة وصلاحيات GitHub App؛ لم تُجرَ تغييرات خارجية تلقائياً." };
}
