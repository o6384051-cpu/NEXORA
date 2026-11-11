import { generateText } from "@/lib/ai/providers";
export const agentRoles = [
 { id:"planner", name:"وكيل التخطيط", instruction:"حلل الهدف وقسمه إلى مراحل مرتبة ومخرجات قابلة للتحقق." },
 { id:"researcher", name:"وكيل البحث", instruction:"حدد المعلومات التي تحتاج إلى مصادر خارجية، ولا تختلق نتائج بحث." },
 { id:"engineer", name:"وكيل الهندسة والبرمجة", instruction:"اقترح بنية تقنية وكوداً آمناً قابلاً للاختبار." },
 { id:"reviewer", name:"وكيل المراجعة والجودة", instruction:"راجع الخطة والمخرجات واكتشف المخاطر والنواقص." },
 { id:"operator", name:"وكيل التنفيذ", instruction:"حوّل الخطة إلى قائمة إجراءات، ولا تدّع تنفيذ إجراء خارجي دون أداة موصولة." },
] as const;
export async function runAgentTeam(task:string, provider?:string) {
 const plan = await generateText([{role:"system",content:agentRoles[0].instruction},{role:"user",content:task}],provider);
 const research = await generateText([{role:"system",content:agentRoles[1].instruction+" لا تملك تصفحاً في هذه المرحلة؛ اذكر بوضوح ما يحتاج بحثاً حقيقياً."},{role:"user",content:task+"\nخطة التخطيط:\n"+plan}],provider);
 const engineering = await generateText([{role:"system",content:agentRoles[2].instruction},{role:"user",content:task+"\nالخطة:\n"+plan+"\nملاحظات البحث:\n"+research}],provider);
 const review = await generateText([{role:"system",content:agentRoles[3].instruction},{role:"user",content:"راجع المخرجات التالية للمهمة: "+task+"\n"+engineering}],provider);
 return { agents: agentRoles.map(a=>({id:a.id,name:a.name,status:"completed"})), plan, research, engineering, review, executionNote:"هذا تنسيق متعدد الوكلاء عبر نماذج نصية؛ لا ينفذ أوامر نظام أو تغييرات GitHub تلقائياً بعد." };
}
