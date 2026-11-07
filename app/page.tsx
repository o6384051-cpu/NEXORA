"use client"; // ضروري جداً لأننا سنستخدم تفاعل المستخدم (State)

import { useState } from "react";
import {
  Activity, BrainCircuit, Code2, Files, Globe2, Mic2, Network,
  Search, ShieldCheck, Sparkles, Workflow, Send, Loader2
} from "lucide-react";

const modules = [
  { icon: BrainCircuit, title: "العقل الذكي", desc: "محادثة وتحليل وفهم السياق والمهام" },
  { icon: Network, title: "الوكيل المستقل", desc: "تخطيط خطوات العمل واستخدام الأدوات بمهام واضحة" },
  { icon: Search, title: "البحث العميق", desc: "جمع المعلومات وتنظيم النتائج والمصادر" },
  { icon: Code2, title: "استوديو البرمجة", desc: "مساحة لإنشاء المشاريع وفحص الأكواد واختبارها" },
  { icon: Files, title: "مساحة الملفات", desc: "قراءة المستندات وتنظيم مخرجات العمل" },
  { icon: Mic2, title: "الصوت", desc: "واجهة جاهزة لإضافة المحادثة الصوتية" },
  { icon: Workflow, title: "الأتمتة", desc: "سير عمل قابل للتكرار والمراقبة" },
  { icon: ShieldCheck, title: "مركز الأمان", desc: "إدارة الصلاحيات وحماية البيانات" },
];

export default function Home() {
  const [prompt, setPrompt] = useState("");
  const [response, setResponse] = useState("");
  const [isLoading, setIsLoading] = useState(false);

  // دالة إرسال الرسالة إلى الذكاء الاصطناعي
  const handleSend = async () => {
    if (!prompt.trim()) return;

    setIsLoading(true);
    setResponse(""); // مسح الرد السابق

    try {
      const res = await fetch("/api/chat", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ message: prompt }),
      });

      const data = await res.json();
      
      if (res.ok) {
        setResponse(data.reply);
      } else {
        setResponse("حدث خطأ: " + (data.error || "غير معروف"));
      }
    } catch (error) {
      setResponse("تعذر الاتصال بالخادم. تأكد من تشغيل المشروع بشكل صحيح.");
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <main className="shell">
      <header className="topbar">
        <a className="brand" href="#">
          <span className="brand-mark"><Sparkles size={19} /></span>
          <span>NEXORA</span>
        </a>
        <div className="top-actions">
          <span className="status"><i /> المرحلة الأساسية</span>
          <button className="btn-ghost">تسجيل الدخول</button>
        </div>
      </header>

      <section className="hero">
        <div className="eyebrow"><span /> NEXT-GENERATION INTELLIGENCE</div>
        <h1>حول <em>أفكارك</em> إلى إنجازات</h1>
        <p>مساحة عمل ذكية تجمع التفكير والبحث والبرمجة والتنفيذ في مكان واحد.</p>
        
        {/* صندوق الإدخال */}
        <div className="prompt-box">
          <textarea 
            aria-label="اكتب طلبك" 
            placeholder="اكتب ما تريد إنجازه مع NEXORA..." 
            rows={2}
            value={prompt}
            onChange={(e) => setPrompt(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === 'Enter' && !e.shiftKey) {
                e.preventDefault();
                handleSend();
              }
            }}
          />
          <div className="prompt-bottom">
            <span><Sparkles size={14} /> ذكاء اصطناعي متاح</span>
            <button 
              className="btn-primary" 
              onClick={handleSend} 
              disabled={isLoading || !prompt.trim()}
              style={{ display: 'flex', alignItems: 'center', gap: '8px' }}
            >
              {isLoading ? <Loader2 size={16} className="animate-spin" /> : <Send size={16} />}
              {isLoading ? "جاري التفكير..." : "إرسال"}
            </button>
          </div>
        </div>

        {/* منطقة عرض الرد */}
        {response && (
          <div style={{
            marginTop: '20px', padding: '20px', backgroundColor: 'rgba(16, 21, 34, 0.92)', 
            border: '1px solid #33415b', borderRadius: '17px', textAlign: 'right',
            whiteSpace: 'pre-wrap', lineHeight: '1.6'
          }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '10px', color: '#63d8e7' }}>
              <BrainCircuit size={20} /> <strong>رد NEXORA:</strong>
            </div>
            {response}
          </div>
        )}

        <div className="trust-note"><ShieldCheck size={14} /> مساحة آمنة ومشفرة</div>
      </section>

      <section className="workspace">
        <div className="section-heading">
          <div><span className="section-kicker">WORKSPACE /</span></div>
          <h2>الوحدات الأساسية</h2>
        </div>
        <div className="module-grid">
          {modules.map(({ icon: Icon, title, desc }, i) => (
            <article className="module-card" key={title}>
              <div className="module-icon"><Icon size={20} /></div>
              <div className="module-number">0{i + 1}</div>
              <h3>{title}</h3><p>{desc}</p>
              <span className="module-state">قيد التطوير</span>
            </article>
          ))}
        </div>
      </section>

      <footer>
        <span>NEXORA AI</span>
        <span>نشيد موثوق</span>
        <span><Activity size={14} /> النظام يعمل</span>
      </footer>
    </main>
  );
                              }
