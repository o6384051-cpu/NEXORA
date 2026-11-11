import { generateText } from "@/lib/ai/providers";

export const agentRoles = [
  { id: "planner", name: "وكيل التخطيط", instruction: "حلل الهدف وقسمه إلى مراحل مرتبة ومخرجات قابلة للتحقق." },
  { id: "researcher", name: "وكيل البحث", instruction: "حلل المصادر الفعلية المرفقة، وميّز الحقائق عن الاستنتاجات." },
  { id: "engineer", name: "وكيل الهندسة والبرمجة", instruction: "اقترح بنية تقنية وكوداً آمناً قابلاً للاختبار." },
  { id: "reviewer", name: "وكيل المراجعة والجودة", instruction: "راجع الخطة والمخرجات واكتشف المخاطر والنواقص." },
  { id: "operator", name: "وكيل التنفيذ", instruction: "حوّل الخطة إلى إجراءات عملية، وحدد بدقة ما نفذته الأدوات وما يحتاج موافقة." },
] as const;

type SearchResult = { title: string; url: string; content: string; score: number };
type StepResult = { text: string; status: "completed" | "failed"; error?: string };

async function runStep(
  id: string,
  messages: Array<{ role: "system" | "user" | "assistant"; content: string }>,
  provider?: string,
): Promise<StepResult> {
  try {
    const text = await generateText(messages, provider);
    return { text, status: "completed" };
  } catch (error) {
    const message = error instanceof Error ? error.message : "تعذر إكمال هذه المرحلة.";
    return { text: `تعذر إكمال هذه المرحلة: ${message}`, status: "failed", error: message };
  }
}

async function researchWeb(task: string): Promise<{ answer: string; sources: SearchResult[]; status: "completed" | "not_configured" | "failed"; error?: string }> {
  const key = process.env.TAVILY_API_KEY;
  if (!key) return { answer: "البحث الحي غير متاح: أضف TAVILY_API_KEY إلى إعدادات الخادم.", sources: [], status: "not_configured" };
  try {
    const response = await fetch("https://api.tavily.com/search", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ api_key: key, query: task, search_depth: "advanced", max_results: 6, include_answer: true }),
      signal: AbortSignal.timeout(25000),
      cache: "no-store",
    });
    const data = await response.json().catch(() => null) as { answer?: string; results?: Array<{ title?: string; url?: string; content?: string; score?: number }> } | null;
    if (!response.ok || !data) return { answer: "تعذر إكمال البحث الحي. تحقق من مفتاح Tavily وحالة الخدمة.", sources: [], status: "failed", error: `Tavily HTTP ${response.status}` };
    const sources = (data.results || [])
      .map((result) => ({ title: result.title || "مصدر", url: result.url || "", content: result.content || "", score: result.score || 0 }))
      .filter((result) => result.url);
    return { answer: String(data.answer || ""), sources, status: "completed" };
  } catch (error) {
    const message = error instanceof Error && error.name === "TimeoutError" ? "انتهت مهلة البحث الحي." : "تعذر الاتصال بمحرك البحث.";
    return { answer: message, sources: [], status: "failed", error: message };
  }
}

export async function runAgentTeam(task: string, provider?: string) {
  const plan = await runStep("planner", [
    { role: "system", content: agentRoles[0].instruction },
    { role: "user", content: task },
  ], provider);

  const webResearch = await researchWeb(task);
  const research = await runStep("researcher", [
    { role: "system", content: agentRoles[1].instruction + " لا تختلق أي مصدر أو معلومة. إذا كانت النتائج غير كافية فقل ذلك صراحة." },
    { role: "user", content: task + "\nخطة التخطيط:\n" + plan.text + "\nملخص محرك البحث:\n" + webResearch.answer + "\nالمصادر والنتائج:\n" + webResearch.sources.map((source, index) => "[" + index + "] " + source.title + " | " + source.url + "\n" + source.content).join("\n\n") },
  ], provider);

  const engineering = await runStep("engineer", [
    { role: "system", content: agentRoles[2].instruction },
    { role: "user", content: task + "\nالخطة:\n" + plan.text + "\nملاحظات البحث:\n" + research.text },
  ], provider);

  const review = await runStep("reviewer", [
    { role: "system", content: agentRoles[3].instruction },
    { role: "user", content: "راجع المخرجات التالية للمهمة: " + task + "\n" + engineering.text },
  ], provider);

  const operator = await runStep("operator", [
    { role: "system", content: agentRoles[4].instruction + " لا تدّع إنشاء ملفات أو تعديل GitHub أو نشر تطبيق. هذه المرحلة تنفذ التحليل والتوصيات فقط." },
    { role: "user", content: "المهمة: " + task + "\nالخطة: " + plan.text + "\nالمخرجات الهندسية: " + engineering.text + "\nالمراجعة: " + review.text },
  ], provider);

  const stepResults = { planner: plan, researcher: research, engineer: engineering, reviewer: review, operator };
  const agentStatuses = agentRoles.map((agent) => {
    const result = stepResults[agent.id as keyof typeof stepResults];
    if (agent.id === "researcher" && webResearch.status !== "completed") {
      return { id: agent.id, name: agent.name, status: result.status, searchStatus: webResearch.status };
    }
    return { id: agent.id, name: agent.name, status: result.status };
  });
  const failed = agentStatuses.filter((agent) => agent.status === "failed").length;

  return {
    agents: agentStatuses,
    agentStatuses,
    plan: plan.text,
    research: research.text,
    engineering: engineering.text,
    review: review.text,
    operator: operator.text,
    searchStatus: webResearch.status,
    searchError: webResearch.error,
    searchSources: webResearch.sources,
    executionStatus: failed === 0 ? "analysis_completed" : "partially_completed",
    executionNote: "هذه الجولة تنفذ التخطيط والبحث والتحليل والمراجعة النصية فقط. لم يتم تشغيل أوامر نظام، أو اختبار ملفات، أو تعديل GitHub، أو نشر تطبيق.",
  };
}
