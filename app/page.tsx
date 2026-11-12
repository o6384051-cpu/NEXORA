"use client";

import Link from "next/link";
import { useEffect, useRef, useState } from "react";
import { Activity, BrainCircuit, Code2, Files, Globe2, Menu, Mic2, Network, Plus, Search, Send, Settings2, ShieldCheck, Sparkles, Trash2, Workflow, X } from "lucide-react";

type Message = { role: "user" | "assistant"; content: string };
type Chat = { id: string; title: string; messages: Message[]; updatedAt: number };
const STORE_KEY = "nexora-local-chats-v1";
const modules = [
  { icon: Network, title: "الوكيل الذكي", detail: "تخطيط المهام ومتابعة مراحلها", href: "/workspace#agents" },
  { icon: Search, title: "البحث", detail: "البحث وجمع المصادر", href: "/workspace#search" },
  { icon: Code2, title: "استوديو البرمجة", detail: "إنشاء المشاريع وفحصها", href: "/workspace#builder" },
  { icon: Files, title: "الملفات", detail: "تحليل وإدارة الملفات", href: "/workspace#files" },
  { icon: Mic2, title: "الصوت", detail: "ميزات الصوت عند تفعيل الخدمة", href: "/workspace#voice" },
  { icon: Workflow, title: "الأتمتة", detail: "المهام المجدولة", href: "/workspace#schedules" },
];
const makeId = () => `${Date.now()}-${Math.random().toString(36).slice(2)}`;

export default function Home() {
  const [chats, setChats] = useState<Chat[]>([]);
  const [activeId, setActiveId] = useState("");
  const [input, setInput] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [ready, setReady] = useState(false);
  const endRef = useRef<HTMLDivElement>(null);
  const active = chats.find((chat) => chat.id === activeId);
  const messages = active?.messages ?? [];

  useEffect(() => {
    try {
      const saved = localStorage.getItem(STORE_KEY);
      if (saved) {
        const parsed = JSON.parse(saved) as Chat[];
        if (Array.isArray(parsed)) {
          setChats(parsed);
          if (parsed[0]) setActiveId(parsed[0].id);
        }
      }
    } catch { /* Ignore damaged local history and start a clean session. */ }
    setReady(true);
  }, []);

  useEffect(() => {
    if (ready) localStorage.setItem(STORE_KEY, JSON.stringify(chats));
  }, [chats, ready]);

  useEffect(() => { endRef.current?.scrollIntoView({ behavior: "smooth", block: "end" }); }, [messages.length, busy]);

  function newChat() {
    const chat: Chat = { id: makeId(), title: "محادثة جديدة", messages: [], updatedAt: Date.now() };
    setChats((old) => [chat, ...old]);
    setActiveId(chat.id);
    setInput("");
    setError("");
    setSidebarOpen(false);
  }

  function removeChat(id: string) {
    const next = chats.filter((chat) => chat.id !== id);
    setChats(next);
    if (activeId === id) setActiveId(next[0]?.id ?? "");
  }

  async function sendMessage() {
    const text = input.trim();
    if (!text || busy) return;
    let chat = active;
    if (!chat) {
      chat = { id: makeId(), title: text.slice(0, 38), messages: [], updatedAt: Date.now() };
      setChats((old) => [chat!, ...old]);
      setActiveId(chat.id);
    }
    const nextMessages = [...chat.messages, { role: "user" as const, content: text }];
    setChats((old) => old.map((item) => item.id === chat!.id ? { ...item, title: item.messages.length ? item.title : text.slice(0, 38), messages: nextMessages, updatedAt: Date.now() } : item));
    setInput("");
    setBusy(true);
    setError("");
    try {
      const response = await fetch("/api/chat", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ messages: nextMessages }),
      });
      const data = await response.json() as { reply?: string; error?: string };
      if (!response.ok) throw new Error(data.error || (response.status === 401 ? "سجّل الدخول أولاً." : "تعذر إكمال الطلب."));
      const answer = data.reply || "لم يصل رد من النموذج.";
      setChats((old) => old.map((item) => item.id === chat!.id ? { ...item, messages: [...nextMessages, { role: "assistant", content: answer }], updatedAt: Date.now() } : item));
    } catch (e) {
      setError(e instanceof Error ? e.message : "تعذر الاتصال بالخادم.");
    } finally { setBusy(false); }
  }

  return (
    <main className="nexora-app" dir="rtl">
      {sidebarOpen && <button className="mobile-scrim" aria-label="إغلاق القائمة" onClick={() => setSidebarOpen(false)} />}
      <aside className={`sidebar ${sidebarOpen ? "sidebar-open" : ""}`}>
        <div className="side-brand"><span className="logo-mark"><Sparkles size={19}/></span><span>NEXORA<small>INTELLIGENCE</small></span><button className="icon-button mobile-close" onClick={() => setSidebarOpen(false)} aria-label="إغلاق"><X size={18}/></button></div>
        <button className="new-chat" onClick={newChat}><Plus size={17}/> محادثة جديدة</button>
        <div className="side-label">المحادثات</div>
        <div className="chat-list">
          {chats.map((chat) => <div key={chat.id} className={`chat-row ${activeId === chat.id ? "selected" : ""}`}>
            <button className="chat-select" onClick={() => { setActiveId(chat.id); setSidebarOpen(false); }}>{chat.title}</button>
            <button className="delete-chat" aria-label="حذف المحادثة" onClick={() => removeChat(chat.id)}><Trash2 size={14}/></button>
          </div>)}
          {ready && chats.length === 0 && <p className="empty-history">ستظهر محادثاتك هنا</p>}
        </div>
        <div className="side-label tools-label">الأدوات</div>
        <nav className="tool-nav">{modules.map(({icon: Icon,title,href}) => <Link href={href} key={title}><Icon size={16}/>{title}</Link>)}</nav>
        <div className="side-bottom"><Link href="/status"><Activity size={16}/> حالة النظام</Link><Link href="/login"><Settings2 size={16}/> إعدادات المسؤول</Link><div className="profile"><span className="profile-avatar">N</span><span><b>NEXORA AI</b><small>مساحة العمل الذكية</small></span><ShieldCheck size={16}/></div></div>
      </aside>

      <section className="main-panel">
        <header className="main-topbar">
          <div className="topbar-start"><button className="icon-button menu-toggle" onClick={() => setSidebarOpen(true)} aria-label="فتح القائمة"><Menu size={20}/></button><span className="breadcrumb">NEXORA <span>/</span> <b>المحادثة</b></span></div>
          <div className="topbar-end"><span className="model-pill"><i/> Gemini عبر إعدادات الخادم</span><Link href="/status" className="top-link">حالة الخدمات</Link></div>
        </header>
        <div className="conversation-scroll">
          {messages.length === 0 ? <div className="welcome">
            <div className="welcome-orb"><BrainCircuit size={31}/><span/></div>
            <div className="welcome-eyebrow">مساحة الذكاء الاصطناعي</div>
            <h1>مرحباً بك في <em>NEXORA</em></h1>
            <p>ما الذي تريد إنجازه اليوم؟ ابدأ محادثة، وسنرتب أفكارك ونساعدك في تحويلها إلى خطوات واضحة.</p>
            <div className="suggestion-grid">
              {[
                {icon: Code2,title:"إنشاء مشروع",text:"ساعدني في بناء تطبيق ويب متكامل"},
                {icon: Search,title:"بحث وتحليل",text:"ابحث عن أفضل الحلول لهذه الفكرة"},
                {icon: Files,title:"تحليل ملف",text:"ساعدني في فهم ملف أو مستند"},
                {icon: Workflow,title:"خطة عمل",text:"حوّل هدفي إلى خطة تنفيذية"},
              ].map(({icon: Icon,title,text}) => <button key={title} className="suggestion" onClick={() => setInput(text)}><Icon size={17}/><span><b>{title}</b><small>{text}</small></span></button>)}
            </div>
          </div> : <div className="messages">
            {messages.map((message,index) => <article key={index} className={`message message-${message.role}`}>
              <div className="message-avatar">{message.role === "assistant" ? <Sparkles size={16}/> : "أنت"}</div>
              <div className="message-body"><div className="message-author">{message.role === "assistant" ? "NEXORA" : "أنت"}</div><div className="message-content">{message.content}</div></div>
            </article>)}
            {busy && <article className="message message-assistant"><div className="message-avatar"><Sparkles size={16}/></div><div className="message-body"><div className="message-author">NEXORA</div><div className="typing"><i/><i/><i/> يفكر الآن</div></div></article>}
            <div ref={endRef}/>
          </div>}
        </div>
        <div className="composer-wrap">
          {error && <div className="chat-error">{error} {error.includes("سجّل الدخول") && <Link href="/login">تسجيل الدخول</Link>}</div>}
          <div className="composer">
            <textarea value={input} onChange={(e) => setInput(e.target.value)} onKeyDown={(e) => { if (e.key === "Enter" && !e.shiftKey) { e.preventDefault(); void sendMessage(); } }} placeholder="اكتب رسالتك إلى NEXORA..." rows={2} maxLength={8000} aria-label="رسالتك"/>
            <div className="composer-footer"><div className="composer-hints"><span><Globe2 size={14}/> العربية</span><span><span className="keycap">↵</span> للإرسال · Shift + Enter لسطر جديد</span></div><button className="send-button" onClick={() => void sendMessage()} disabled={!input.trim() || busy}><Send size={17}/><span>إرسال</span></button></div>
          </div>
          <p className="disclaimer">قد يخطئ الذكاء الاصطناعي. راجع المعلومات المهمة قبل الاعتماد عليها.</p>
        </div>
      </section>
    </main>
  );
}
