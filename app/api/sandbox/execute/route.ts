import { NextResponse } from "next/server";
import { Sandbox } from "@vercel/sandbox";
import { isAuthorized } from "@/lib/auth";

export const runtime = "nodejs";
export const maxDuration = 60;

const MAX_CODE_LENGTH = 20_000;
const MAX_OUTPUT_LENGTH = 12_000;
const TIMEOUT_MS = 30_000;

export async function POST(request: Request) {
  if (!(await isAuthorized(request))) {
    return NextResponse.json({ error: "سجّل الدخول أولاً." }, { status: 401 });
  }

  const body = await request.json().catch(() => null) as
    | { code?: unknown; language?: unknown }
    | null;
  if (!body || typeof body.code !== "string" || !body.code.trim()) {
    return NextResponse.json({ error: "أرسل الشيفرة المراد تشغيلها." }, { status: 400 });
  }
  if (body.code.length > MAX_CODE_LENGTH) {
    return NextResponse.json({ error: "الحد الأقصى للشيفرة 20000 حرف." }, { status: 413 });
  }

  const language = body.language === "javascript" ? "javascript" : body.language === "python" ? "python" : null;
  if (!language) {
    return NextResponse.json({ error: "اللغات المدعومة حالياً: Python وJavaScript." }, { status: 400 });
  }

  let sandbox: Sandbox | undefined;
  try {
    // Untrusted code receives no application secrets and has no network egress.
    sandbox = await Sandbox.create({
      resources: { vcpus: 1 },
      timeout: TIMEOUT_MS,
      persistent: false,
      networkPolicy: "deny-all",
    });

    const result = language === "python"
      ? await sandbox.runCommand("python3", ["-c", body.code])
      : await sandbox.runCommand("node", ["-e", body.code]);

    const [stdout, stderr] = await Promise.all([result.stdout(), result.stderr()]);
    return NextResponse.json({
      language,
      exitCode: result.exitCode,
      stdout: stdout.slice(0, MAX_OUTPUT_LENGTH),
      stderr: stderr.slice(0, MAX_OUTPUT_LENGTH),
      truncated: stdout.length > MAX_OUTPUT_LENGTH || stderr.length > MAX_OUTPUT_LENGTH,
      isolation: "firecracker-microvm",
      network: "denied",
      timeoutMs: TIMEOUT_MS,
    });
  } catch {
    return NextResponse.json(
      { error: "تعذر تشغيل الشيفرة في البيئة المعزولة. تحقق من تفعيل Vercel Sandbox وصلاحيات المشروع." },
      { status: 503 },
    );
  } finally {
    if (sandbox) {
      await sandbox.stop().catch(() => undefined);
    }
  }
}
