"use client";

import Link from "next/link";
import { useState } from "react";
import {
  Activity, BrainCircuit, Code2, Files, Mic2, Network, Search,
  ShieldCheck, Sparkles, Workflow, Send, Loader2
} from "lucide-react";

const modules = [
  { icon: BrainCircuit, title: "العقل الذكي", desc: "محادثة الذكاء الاصطناعي بعد دخول المسؤول.", href: "/login" },
  { icon: Network, title: "فريق التحليل", desc: "تخطيط وبحث ومراجعة؛ التنفيذ الآلي الكامل قيد التطوير.", href: "/workspace#agents" },
  { icon: Search, title: "البحث المباشر", desc: "بحث ويب عند إعداد مفتاح Tavily.", href: "/workspace#search" },
  { icon: Code2, title: "استوديو المشاريع", desc: "توليد ملفات ثم اختبار البناء داخل بيئة معزولة.", href: "/workspace#builder" },
  { icon: Files, title: "تحليل الملفات", desc: "تحليل TXT وMD وCSV وJSON حالياً.", href: "/workspace#files" },
  { icon: Mic2, title: "الصوت", desc: "إدخال صوتي وقراءة صوتية وصوت مباشر عند توافر المفتاح.", href: "/workspace#voice" },
  { icon: Workflow, title: "المهام المجدولة", desc: "تحتاج مخزن Redis ومشغل Cron؛ التوقيت ليس فورياً.", href: "/workspace#schedules" },
  { icon: ShieldCheck, title: "حالة الخدمات", desc: "فحص إعدادات الخدمات؛ لا يمثل تدقيقاً أمنياً كاملاً.", href: "/status" },
];

export default function Home() {
  const [prompt, setPrompt] = useState("");
  const [response, setResponse] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const [needsLogin, setNeedsLogin] = useState(false);

  async function handleSend() {
    const message = prompt.trim();
    if (!message || isLoading) return;
    setIsLoading(true);
    setResponse("");
    setNeedsLogin(false);
    try {
      const res = await fetch("/api/chat", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ message }),
      });
      const data: { reply?: string; error?: string } = await res.json();
      if (res.status === 401) setNeedsLogin(true);
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
            {needsLogin && <p><Link className="status" href="/login">سجّل دخول المسؤول لتفعيل الدردشة</Link></p>}
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
          {modules.map(({ icon: Icon, title, desc, href }, index) => (
            <Link className="module-card" href={href} key={title} aria-label={title + ": " + desc}>
              <div className="module-icon"><Icon size={20} /></div>
              <div className="module-number">0{index + 1}</div>
              <h3>{title}</h3><p>{desc}</p>
              <span className="module-state">فتح الوحدة ←</span>
            </Link>
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
