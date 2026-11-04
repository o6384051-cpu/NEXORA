import {
  Activity, BrainCircuit, Code2, Files, Globe2, Mic2, Network,
  Search, ShieldCheck, Sparkles, Workflow
} from "lucide-react";

const modules = [
  { icon: BrainCircuit, title: "العقل الذكي", desc: "محادثة وتحليل وفهم للسياق والمهام." },
  { icon: Network, title: "الوكيل المستقل", desc: "تخطيط خطوات العمل واستخدام الأدوات بصلاحيات واضحة." },
  { icon: Search, title: "البحث العميق", desc: "جمع المعلومات وتنظيم النتائج والمصادر." },
  { icon: Code2, title: "استوديو البرمجة", desc: "مساحة لإنشاء المشاريع وفحص الأكواد واختبارها." },
  { icon: Files, title: "مساحة الملفات", desc: "قراءة المستندات وتنظيم مخرجات العمل." },
  { icon: Mic2, title: "الصوت", desc: "واجهة جاهزة لإضافة المحادثة الصوتية." },
  { icon: Workflow, title: "الأتمتة", desc: "سير عمل قابل للتكرار والمراقبة." },
  { icon: ShieldCheck, title: "مركز الأمان", desc: "إدارة الصلاحيات وحماية البيانات." },
];

export default function Home() {
  return (
    <main className="shell">
      <header className="topbar">
        <a className="brand" href="#"><span className="brand-mark"><Sparkles size={19}/></span>NEXORA<span className="brand-ai">AI</span></a>
        <div className="top-actions"><span className="status"><i/> مرحلة التأسيس</span><button className="avatar" aria-label="الحساب">N</button></div>
      </header>

      <section className="hero">
        <div className="eyebrow"><span/> NEXT-GENERATION INTELLIGENCE</div>
        <h1>حوّل أفكارك إلى <em>إنجازات.</em></h1>
        <p>مساحة عمل ذكية تجمع التفكير والبحث والبرمجة والتنفيذ في مكان واحد.</p>
        <div className="prompt-box">
          <textarea aria-label="اكتب مهمتك" placeholder="اكتب ما تريد إنجازه مع NEXORA..." rows={2}/>
          <div className="prompt-bottom"><span><Sparkles size={14}/> العقل الذكي — قيد الإعداد</span><button disabled title="سيتم تفعيل المحادثة بعد ربط مزود الذكاء الاصطناعي">ابدأ المهمة <span>↗</span></button></div>
        </div>
        <div className="trust-note"><ShieldCheck size={14}/> لن يتم تنفيذ أي إجراء حساس دون صلاحية وموافقة.</div>
      </section>

      <section className="workspace">
        <div className="section-heading"><div><span className="section-kicker">WORKSPACE</span><h2>مساحة NEXORA</h2></div><span className="count">08 وحدات مخططة</span></div>
        <div className="module-grid">
          {modules.map(({icon: Icon, title, desc}, i) => (
            <article className="module-card" key={title}>
              <div className="module-icon"><Icon size={20}/></div>
              <div className="module-number">0{i+1}</div>
              <h3>{title}</h3><p>{desc}</p>
              <span className="module-state">ضمن خارطة التطوير</span>
            </article>
          ))}
        </div>
      </section>
      <footer><span>NEXORA AI</span><span>ذكاء مسؤول. تنفيذ موثوق.</span><span><Activity size={13}/> Foundation v0.1.0</span></footer>
    </main>
  );
}
