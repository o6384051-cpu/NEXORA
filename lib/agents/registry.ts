import { generateText } from "@/lib/ai/providers";

export const agentRoles = [
  { id: "planner", name: "وكيل التخطيط", instruction: "حلل الهدف وقسمه إلى مراحل مرتبة ومخرجات قابلة للتحقق." },
  { id: "researcher", name: "وكيل البحث", instruction: "حلل المصادر الفعلية المرفقة، وميّز الحقائق عن الاستنتاجات." },
  { id: "engineer", name: "وكيل الهندسة العميقة",
    instruction: [
      "أنت كبير مهندسي الأنظمة والبرمجيات في NEXORA، ومسؤول عن الهندسة العميقة لا عن اقتراح كود سريع فقط.",
      "حوّل الطلب إلى متطلبات وظيفية وغير وظيفية، وصرّح بالافتراضات والقيود والمعلومات الناقصة.",
      "حلل البنية الحالية والتبعيات وحدود الخدمات وتدفق البيانات قبل اقتراح أي تغيير. لا تفترض وجود ملفات أو أدوات أو تكاملات لم تُذكر.",
      "قدّم بنية معمارية واضحة: المكونات ومسؤولية كل مكون، واجهات الربط، تدفق الطلب والبيانات، ونقاط الفشل.",
      "قارن البدائل التقنية واذكر سبب الاختيار ومقايضاته في الأداء والتكلفة والتوسع والصيانة.",
      "غطِّ الأمن: المصادقة والتفويض وعزل البيانات، التحقق من المدخلات، حماية الأسرار، تقليل الصلاحيات، ومخاطر حقن التعليمات.",
      "غطِّ الاعتمادية: المهلات، إعادة المحاولة المحدودة، منع التكرار، حدود المعدل، فشل المزود، السجلات والمراقبة والتعافي.",
      "ضع خطة تنفيذ تدريجية غير مدمرة: الوحدات المتوقع تغييرها، التوافق الخلفي، الترحيل، وخطة التراجع. لا تستبدل كوداً مستقراً دون ضرورة موضحة.",
      "حدّد اختبارات الوحدة والتكامل والأمان والأداء ومعايير قبول قابلة للقياس.",
      "للمهام الهندسية أو الصناعية أو المتعلقة بأنظمة مادية، افصل الحسابات والقيود والمواد والمخاطر التشغيلية، ولا تخترع مواصفات أو نتائج اختبار.",
      "أخرج النتيجة بهذا الترتيب: فهم المشكلة والمتطلبات؛ تحليل الوضع والقيود؛ التصميم ومخطط تدفق نصي؛ البدائل وسبب الاختيار؛ المخاطر والأمان؛ خطة التنفيذ؛ الاختبارات ومعايير القبول؛ ما لا يمكن الجزم به.",
      "ميّز دائماً بين التصميم المقترح والعمل المنفذ فعلياً. لا تدّع تعديل ملفات أو تشغيل اختبارات أو نشر خدمة ما لم تؤكد الأدوات ذلك."
    ].join("\\n")
  },
  { id: "reviewer", name: "وكيل المراجعة والجودة", instruction: "راجع الخطة والمخرجات واكتشف المخاطر والنواقص." },
  { id: "operator", name: "وكيل التنفيذ", instruction: "حوّل الخطة إلى إجراءات عملية، وحدد بدقة ما نفذته الأدوات وما يحتاج موافقة." },
] as const;

type SearchResult = { title: string; url: string; content: string; score: number };
type StepResult = { text: string; status: "completed" | "failed"; error?: string };

async function runStep(
  messages: Array<{ role: "system" | "user" | "assistant"; content: string }>,
  provider?: string,
): Promise<StepResult> {
  try {
    const text = await generateText(messages, provider, { timeoutMs: 16000, maxAttempts: 1 });
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
      signal: AbortSignal.timeout(9000),
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
  const [plan, webResearch] = await Promise.all([
    runStep([
      { role: "system", content: agentRoles[0].instruction },
      { role: "user", content: task },
    ], provider),
    researchWeb(task),
  ]);
  const [research, engineering] = await Promise.all([
    runStep([
      { role: "system", content: agentRoles[1].instruction + " لا تختلق أي مصدر أو معلومة. إذا كانت النتائج غير كافية فقل ذلك صراحة." },
      { role: "user", content: task + "\nخطة التخطيط:\n" + plan.text + "\nملخص محرك البحث:\n" + webResearch.answer + "\nالمصادر والنتائج:\n" + webResearch.sources.map((source, index) => "[" + index + "] " + source.title + " | " + source.url + "\n" + source.content).join("\n\n") },
    ], provider),
    runStep([
      { role: "system", content: agentRoles[2].instruction },
      { role: "user", content: task + "\nالخطة:\n" + plan.text },
    ], provider),
  ]);

  const [review, operator] = await Promise.all([
    runStep([
      { role: "system", content: agentRoles[3].instruction + " افحص اتساق التصميم الهندسي، قابلية الاختبار، سلامة الترحيل، وخطة التراجع. أشر إلى أي ادعاء غير مدعوم." },
      { role: "user", content: "راجع المخرجات التالية للمهمة: " + task + "\n" + engineering.text + "\nنتائج البحث:\n" + research.text },
    ], provider),
    runStep([
      { role: "system", content: agentRoles[4].instruction + " لا تدّع إنشاء ملفات أو تعديل GitHub أو نشر تطبيق. هذه المرحلة تنفذ التحليل والتوصيات فقط." },
      { role: "user", content: "المهمة: " + task + "\nالخطة: " + plan.text + "\nالمخرجات الهندسية: " + engineering.text },
    ], provider),
  ]);

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
    executionNote: "هذه الجولة تنفذ التخطيط والبحث والتصميم الهندسي العميق والمراجعة النصية فقط. تم تشغيل الأدوار في موجات متوازية لتقليل المهلة. لم يتم تشغيل أوامر نظام، أو اختبار ملفات، أو تعديل GitHub، أو نشر تطبيق.",
  };
}
