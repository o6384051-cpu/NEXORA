"use client";

import { useCallback, useEffect, useState } from "react";
import Link from "next/link";

type Memory = {
  id: string;
  title: string;
  content: string;
  category: "preference" | "project" | "fact" | "note";
  createdAt: string;
  updatedAt: string;
};

const labels: Record<Memory["category"], string> = {
  preference: "تفضيل",
  project: "مشروع",
  fact: "معلومة",
  note: "ملاحظة",
};

export default function MemoryPage() {
  const [items, setItems] = useState<Memory[]>([]);
  const [title, setTitle] = useState("");
  const [content, setContent] = useState("");
  const [category, setCategory] = useState<Memory["category"]>("note");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [ready, setReady] = useState(false);

  const load = useCallback(async () => {
    setBusy(true);
    setError("");
    try {
      const response = await fetch("/api/memory", { cache: "no-store" });
      const data = await response.json();
      if (!response.ok) throw new Error(data.error || "تعذر تحميل الذاكرة.");
      setItems(Array.isArray(data.memories) ? data.memories : []);
    } catch (e) {
      setError(e instanceof Error ? e.message : "تعذر تحميل الذاكرة.");
    } finally {
      setBusy(false);
      setReady(true);
    }
  }, []);

  useEffect(() => { void load(); }, [load]);

  async function save(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setBusy(true);
    setError("");
    try {
      const response = await fetch("/api/memory", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ title, content, category }),
      });
      const data = await response.json();
      if (!response.ok) throw new Error(data.error || "تعذر حفظ الذاكرة.");
      setTitle("");
      setContent("");
      await load();
    } catch (e) {
      setError(e instanceof Error ? e.message : "تعذر حفظ الذاكرة.");
    } finally {
      setBusy(false);
    }
  }

  async function remove(id: string) {
    if (!window.confirm("هل تريد حذف هذه المعلومة من ذاكرة NEXORA؟")) return;
    setBusy(true);
    setError("");
    try {
      const response = await fetch("/api/memory", {
        method: "DELETE",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ id }),
      });
      const data = await response.json();
      if (!response.ok || !data.deleted) throw new Error(data.error || "تعذر حذف الذاكرة.");
      setItems((current) => current.filter((item) => item.id !== id));
    } catch (e) {
      setError(e instanceof Error ? e.message : "تعذر حذف الذاكرة.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <main dir="rtl" style={{ maxWidth: 900, margin: "0 auto", padding: 24, color: "var(--foreground, #f4f4f5)" }}>
      <header style={{ display: "flex", justifyContent: "space-between", gap: 12, flexWrap: "wrap", marginBottom: 24 }}>
        <Link href="/workspace">← مساحة العمل</Link>
        <Link href="/status">حالة الخدمات</Link>
      </header>
      <h1>الذاكرة الدائمة</h1>
      <p>احفظ معلومات المشاريع والتفضيلات والملاحظات لتظل متاحة بعد إعادة تشغيل التطبيق. لا تُحفظ أي معلومة تلقائياً دون إدخالها هنا.</p>
      {error && <p role="alert" style={{ padding: 12, border: "1px solid #b45309", borderRadius: 8 }}>{error}</p>}
      <form onSubmit={save} style={{ display: "grid", gap: 12, padding: 16, border: "1px solid #555", borderRadius: 12, margin: "20px 0" }}>
        <label>عنوان المعلومة<input required maxLength={120} value={title} onChange={(e) => setTitle(e.target.value)} style={{ display: "block", width: "100%", padding: 10, marginTop: 6 }} /></label>
        <label>المحتوى<textarea required maxLength={4000} rows={4} value={content} onChange={(e) => setContent(e.target.value)} style={{ display: "block", width: "100%", padding: 10, marginTop: 6 }} /></label>
        <label>التصنيف<select value={category} onChange={(e) => setCategory(e.target.value as Memory["category"])} style={{ display: "block", padding: 10, marginTop: 6 }}><option value="note">ملاحظة</option><option value="preference">تفضيل</option><option value="project">مشروع</option><option value="fact">معلومة</option></select></label>
        <button type="submit" disabled={busy} style={{ padding: 12, borderRadius: 8 }}>{busy ? "جارٍ الحفظ..." : "حفظ في الذاكرة"}</button>
      </form>
      <h2>المحفوظات ({items.length})</h2>
      {!ready && <p>جارٍ تحميل الذاكرة...</p>}
      {ready && items.length === 0 && <p>لا توجد معلومات محفوظة بعد.</p>}
      <section style={{ display: "grid", gap: 12 }}>
        {items.map((item) => (
          <article key={item.id} style={{ border: "1px solid #555", borderRadius: 12, padding: 16 }}>
            <div style={{ display: "flex", justifyContent: "space-between", gap: 12, flexWrap: "wrap" }}>
              <strong>{item.title}</strong>
              <span>{labels[item.category]}</span>
            </div>
            <p style={{ whiteSpace: "pre-wrap" }}>{item.content}</p>
            <small>آخر تحديث: {new Date(item.updatedAt).toLocaleString("ar-EG")}</small>
            <div><button type="button" disabled={busy} onClick={() => void remove(item.id)} style={{ marginTop: 12, padding: "8px 14px" }}>حذف</button></div>
          </article>
        ))}
      </section>
    </main>
  );
}
