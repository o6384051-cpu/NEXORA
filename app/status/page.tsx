"use client";

import { useEffect, useState } from "react";
import Link from "next/link";

type Check = { id: string; label: string; configured: boolean; required: boolean; detail: string };
type Status = { provider: string; requiredReady: boolean; checks: Check[]; generatedAt: string; note: string };
type LiveCheck = { id: string; label: string; status: "ok" | "failed" | "not_configured" | "config_only"; detail: string };
type Diagnostics = { checks: LiveCheck[]; summary: { passed: number; failed: number; notConfigured: number; configOnly: number }; generatedAt: string; note: string };

const statusLabel: Record<LiveCheck["status"], string> = {
  ok: "نجح الاتصال",
  failed: "فشل الاتصال",
  not_configured: "غير مهيأ",
  config_only: "إعداد موجود — لم يُشغّل",
};

export default function StatusPage() {
  const [status, setStatus] = useState<Status | null>(null);
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(true);
  const [testing, setTesting] = useState(false);
  const [diagnostics, setDiagnostics] = useState<Diagnostics | null>(null);

  async function refresh() {
    setLoading(true);
    setError("");
    try {
      const response = await fetch("/api/system/status", { cache: "no-store" });
      const data = await response.json();
      if (!response.ok) throw new Error(data.error || "تعذر قراءة حالة الإعدادات.");
      setStatus(data as Status);
    } catch (err) {
      setError(err instanceof Error ? err.message : "حدث خطأ.");
    } finally {
      setLoading(false);
    }
  }

  async function runLiveTests() {
    setTesting(true);
    setError("");
    setDiagnostics(null);
    try {
      const response = await fetch("/api/system/diagnostics", { method: "POST", headers: { "Content-Type": "application/json" }, body: "{}" });
      const data = await response.json();
      if (!response.ok) throw new Error(data.error || "تعذر تشغيل الاختبارات الحية.");
      setDiagnostics(data as Diagnostics);
    } catch (err) {
      setError(err instanceof Error ? err.message : "تعذر تشغيل الاختبارات الحية.");
    } finally {
      setTesting(false);
    }
  }

  useEffect(() => { void refresh(); }, []);

  const configuredCount = status?.checks.filter((item) => item.configured).length ?? 0;
  const totalCount = status?.checks.length ?? 0;

  return (
    <main dir="rtl" style={{ maxWidth: 850, margin: "36px auto", padding: 20, color: "#edf3ff", fontFamily: "Arial, sans-serif" }}>
      <header style={{ display: "flex", justifyContent: "space-between", gap: 12, flexWrap: "wrap", marginBottom: 24 }}>
        <Link href="/workspace" style={{ color: "#75dbe8" }}>← مساحة العمل</Link>
        <Link href="/login" style={{ color: "#75dbe8" }}>دخول المسؤول</Link>
      </header>
      <h1>فحص جاهزية NEXORA</h1>
      <p style={{ color: "#aab8cc" }}>مراجعة إعدادات الخدمات، ثم اختبار اتصال حقيقي بالخدمات المتاحة.</p>
      <div style={{ display: "flex", gap: 10, flexWrap: "wrap" }}>
        <button onClick={() => void refresh()} disabled={loading || testing} style={{ padding: "10px 16px", borderRadius: 8, border: 0, cursor: "pointer" }}>
          {loading ? "جارٍ فحص الإعدادات..." : "إعادة فحص الإعدادات"}
        </button>
        <button onClick={() => void runLiveTests()} disabled={testing || loading} style={{ padding: "10px 16px", borderRadius: 8, border: 0, cursor: "pointer", background: "#176b75", color: "white" }}>
          {testing ? "جارٍ اختبار الاتصالات..." : "تشغيل الاختبارات الحية"}
        </button>
      </div>
      <p style={{ color: "#e5bd77", fontSize: 13 }}>الاختبارات لا تنشئ صوراً أو فيديو ولا تنشر تطبيقاً. اختبار البحث يستهلك رصيد استعلام واحد من Tavily.</p>
      {error && <p role="alert" style={{ color: "#ffb6ad" }}>{error}</p>}
      {diagnostics && <>
        <section style={{ margin: "18px 0", padding: 16, border: "1px solid #34445d", borderRadius: 12, background: "#101a2a" }}>
          <strong>نتيجة الاتصال الحي</strong>
          <p>{diagnostics.summary.passed} ناجح · {diagnostics.summary.failed} فاشل · {diagnostics.summary.notConfigured} غير مهيأ · {diagnostics.summary.configOnly} إعداد فقط</p>
        </section>
        <div style={{ display: "grid", gap: 10 }}>
          {diagnostics.checks.map((item) => <article key={item.id} style={{ padding: 14, border: "1px solid #34445d", borderRadius: 10, background: "#101a2a" }}>
            <div style={{ display: "flex", justifyContent: "space-between", gap: 12, flexWrap: "wrap" }}>
              <strong>{item.label}</strong>
              <span style={{ color: item.status === "ok" ? "#7ee0a3" : item.status === "failed" ? "#ff9e91" : "#e5bd77" }}>{statusLabel[item.status]}</span>
            </div>
            <p style={{ color: "#aab8cc", marginBottom: 0 }}>{item.detail}</p>
          </article>)}
        </div>
        <p style={{ color: "#aab8cc", fontSize: 13 }}>{diagnostics.note}</p>
        <p style={{ color: "#aab8cc", fontSize: 12 }}>آخر اختبار حي: {new Date(diagnostics.generatedAt).toLocaleString("ar-EG")}</p>
      </>}
      {status && <>
        <section style={{ margin: "18px 0", padding: 16, border: "1px solid #34445d", borderRadius: 12, background: "#101a2a" }}>
          <strong>{status.requiredReady ? "الإعدادات الأساسية موجودة" : "توجد إعدادات أساسية ناقصة"}</strong>
          <p>{configuredCount} من {totalCount} إعدادات خدمات موجودة · مزود الذكاء: {status.provider}</p>
        </section>
        <div style={{ display: "grid", gap: 10 }}>
          {status.checks.map((item) => <article key={item.id} style={{ padding: 14, border: "1px solid #34445d", borderRadius: 10, background: "#101a2a" }}>
            <div style={{ display: "flex", justifyContent: "space-between", gap: 12 }}>
              <strong>{item.label}</strong>
              <span style={{ color: item.configured ? "#7ee0a3" : item.required ? "#ff9e91" : "#e5bd77" }}>
                {item.configured ? "موجود" : item.required ? "مطلوب" : "غير مفعّل"}
              </span>
            </div>
            <p style={{ color: "#aab8cc", marginBottom: 0 }}>{item.detail}</p>
          </article>)}
        </div>
        <p style={{ color: "#aab8cc", fontSize: 13, marginTop: 18 }}>{status.note}</p>
        <p style={{ color: "#aab8cc", fontSize: 12 }}>آخر فحص إعدادات: {new Date(status.generatedAt).toLocaleString("ar-EG")}</p>
      </>}
    </main>
  );
}
