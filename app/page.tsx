"use client";

import Link from "next/link";
import { useState } from "react";
import {
  Activity, BrainCircuit, Code2, Files, Mic2, Network, Search,
  ShieldCheck, Sparkles, Workflow, Send, Loader2
} from "lucide-react";

const modules = [
  { icon: BrainCircuit, title: "العقل الذكي", desc: "محادثة وتحليل وفهم السياق والمهام." },
  { icon: Network, title: "الوكيل المستقل", desc: "تخطيط خطوات العمل واستخدام الأدوات بصلاحيات واضحة." },
  { icon: Search, title: "البحث العميق", desc: "جمع المعلومات وتنظيم النتائج والمصادر." },
  { icon: Code2, title: "استوديو البرمجة", desc: "إنشاء المشاريع وفحص الأكواد واختبارها." },
  { icon: Files, title: "مساحة الملفات", desc: "قراءة المستندات وتنظيم مخرجات العمل." },
  { icon: Mic2, title: "الصوت", desc: "المحادثة الصوتية ضمن مراحل التطوير." },
  { icon: Workflow, title: "الأتمتة", desc: "سير عمل قابل للتكرار والمراقبة." },
  { icon: ShieldCheck, title: "مركز الأمان", desc: "إدارة الصلاحيات وحماية البيانات." },
];

export default function Home() {
  const [prompt, setPrompt] = useState("");
  const [response, setResponse] = useState("");
  const [isLoading, setIsLoading] = useState(false);

  async function handleSend() {
    const message = prompt.trim();
    if (!message || isLoading) return;
    setIsLoading(true);
    setResponse("");
    try {
      const res = await fetch("/api/chat", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ message }),
      });
      const data: { reply?: string; error?: string } = await res.json();
      if (!res.ok) throw new Error(data.error || "تعذر إكمال الطلب.");
      setResponse(data.reply || "لم يصل رد من مزود الذكاء الاصطناعي.");
    } catch (error) {
      setResponse(error instanceof Error ? error.message : "حدث خطأ غير متوقع.");
    } finally {
      setIsLoading(false);
    }
  }

  return (
    <main className="shell">
      <header className="topbar">
        <Link className="brand" href="/" aria-label="NEXORA AI">
          <span className="brand-mark"><Sparkles size={19} /></span>
          NEXORA<span className="brand-ai">AI</span>
        </Link>
        <div className="top-actions">
          <Link className="status" href="/login">دخول المسؤول</Link><Link className="status" href="/workspace">مساحة التنفيذ ←</Link><span className="status"><i /> مرحلة التأسيس</span>
          <span className="avatar" aria-label="NEXORA">N</span>
        </div>
      </header>
      <section className="hero">
        <div className="eyebrow"><span /> NEXT-GENERATION INTELLIGENCE</div>
        <h1>حوّل أفكارك إلى <em>إنجازات.</em></h1>
        <p>مساحة عمل ذكية تجمع التفكير والبحث والبرمجة والتنفيذ في مكان واحد.</p>
        <div className="prompt-box">
          <textarea
            aria-label="اكتب مهمتك"
            placeholder="اكتب ما تريد إنجازه مع NEXORA..."
            rows={3}
            maxLength={8000}
            value={prompt}
            onChange={(event) => setPrompt(event.target.value)}
            onKeyDown={(event) => {
              if (event.key === "Enter" && !event.shiftKey) {
                event.preventDefault();
                void handleSend();
              }
            }}
          />
          <div className="prompt-bottom">
            <span><Sparkles size={14} /> العقل الذكي</span>
            <button type="button" onClick={() => void handleSend()} disabled={isLoading || !prompt.trim()}>
              {isLoading ? <Loader2 size={16} className="spin" /> : <Send size={16} />}
              {isLoading ? "جاري التفكير..." : "إرسال"}
            </button>
          </div>
        </div>
        {response && (
          <div className="response-box" role="status" aria-live="polite">
            <div className="response-title"><BrainCircuit size={19} /> <strong>رد NEXORA</strong></div>
            <p>{response}</p>
          </div>
        )}
        <div className="trust-note"><ShieldCheck size={14} /> لا يتم تنفيذ أي إجراء خارجي حساس دون صلاحية وموافقة.</div>
      </section>
      <section className="workspace">
        <div className="section-heading">
          <div><span className="section-kicker">WORKSPACE</span><h2>مساحة NEXORA</h2></div>
          <span className="count">08 وحدات ضمن الخطة</span>
        </div>
        <div className="module-grid">
          {modules.map(({ icon: Icon, title, desc }, index) => (
            <article className="module-card" key={title}>
              <div className="module-icon"><Icon size={20} /></div>
              <div className="module-number">0{index + 1}</div>
              <h3>{title}</h3><p>{desc}</p>
              <span className="module-state">ضمن خارطة التطوير</span>
            </article>
          ))}
        </div>
      </section>
      <footer>
        <span>NEXORA AI</span>
        <span>ذكاء مسؤول. تنفيذ موثوق.</span>
        <span><Activity size={13} /> Foundation v0.1.1</span>
      </footer>
    </main>
  );
}
