import { NextResponse } from "next/server";
import { Sandbox } from "@vercel/sandbox";
import { isAuthorized } from "@/lib/auth";

export const runtime = "nodejs";
export const maxDuration = 60;

type ProjectFile = { path?: unknown; content?: unknown };

function outputLimit(value: string, limit = 12_000) {
  return value.length > limit ? value.slice(0, limit) + "\n… تم اختصار السجل." : value;
}

function validPath(path: string) {
  if (!path || path.length > 180 || path.startsWith("/") || path.includes("\\") || path.includes("\0")) return false;
  const parts = path.split("/");
  return parts.every((part) => part && part !== "." && part !== "..") &&
    !parts.some((part) => part === ".git" || part === ".vercel");
}

export async function POST(request: Request) {
  if (!(await isAuthorized(request))) {
    return NextResponse.json({ error: "سجّل الدخول أولاً من صفحة المسؤول." }, { status: 401 });
  }

  const body = await request.json().catch(() => ({})) as { files?: ProjectFile[] };
  if (!Array.isArray(body.files) || body.files.length < 1 || body.files.length > 25) {
    return NextResponse.json({ error: "أرسل من 1 إلى 25 ملفاً للمشروع." }, { status: 400 });
  }

  const files: Array<{ path: string; content: Buffer }> = [];
  const seen = new Set<string>();
  let totalBytes = 0;

  for (const item of body.files) {
    if (typeof item.path !== "string" || typeof item.content !== "string" || !validPath(item.path) || seen.has(item.path)) {
      return NextResponse.json({ error: "يوجد مسار غير صالح أو ملف مكرر." }, { status: 400 });
    }
    const content = Buffer.from(item.content, "utf8");
    totalBytes += content.byteLength;
    if (totalBytes > 500_000) {
      return NextResponse.json({ error: "حجم ملفات المشروع يتجاوز 500 كيلوبايت." }, { status: 413 });
    }
    seen.add(item.path);
    files.push({ path: item.path, content });
  }

  const packageFile = files.find((file) => file.path === "package.json");
  if (!packageFile) {
    return NextResponse.json({ error: "لا يمكن تشغيل المشروع: ملف package.json غير موجود." }, { status: 400 });
  }

  let packageJson: { scripts?: { build?: unknown } };
  try {
    packageJson = JSON.parse(packageFile.content.toString("utf8")) as typeof packageJson;
  } catch {
    return NextResponse.json({ error: "ملف package.json ليس JSON صالحاً." }, { status: 400 });
  }
  if (typeof packageJson.scripts?.build !== "string" || !packageJson.scripts.build.trim()) {
    return NextResponse.json({ error: "أضف أمراً صالحاً باسم scripts.build إلى package.json أولاً." }, { status: 400 });
  }

  let sandbox: Sandbox | undefined;
  let phase: "starting" | "install" | "build" = "starting";

  try {
    sandbox = await Sandbox.create({
      image: "vercel/sandbox/node:24",
      resources: { vcpus: 1 },
      timeout: 55_000,
      persistent: false,
      networkPolicy: "allow-all",
    });

    await sandbox.writeFiles(files.map((file) => ({ path: file.path, content: file.content })));

    phase = "install";
    const install = await sandbox.runCommand({
      cmd: "npm",
      args: ["install", "--ignore-scripts", "--no-audit", "--no-fund", "--package-lock=false"],
      cwd: "/vercel/sandbox",
      timeoutMs: 25_000,
    });
    const installStdout = await install.stdout();
    const installStderr = await install.stderr();
    if (install.exitCode !== 0) {
      return NextResponse.json({
        ok: false,
        phase,
        error: "فشل تثبيت اعتماديات المشروع داخل البيئة المعزولة.",
        exitCode: install.exitCode,
        stdout: outputLimit(installStdout),
        stderr: outputLimit(installStderr),
      }, { status: 422 });
    }

    // Package installation is the only phase with outbound network access.
    // Generated build commands run with all outbound network access disabled.
    await sandbox.update({ networkPolicy: "deny-all" });

    phase = "build";
    const build = await sandbox.runCommand({
      cmd: "npm",
      args: ["run", "build"],
      cwd: "/vercel/sandbox",
      timeoutMs: 25_000,
    });
    const stdout = await build.stdout();
    const stderr = await build.stderr();

    return NextResponse.json({
      ok: build.exitCode === 0,
      phase,
      status: build.exitCode === 0 ? "build_succeeded" : "build_failed",
      exitCode: build.exitCode,
      stdout: outputLimit(stdout),
      stderr: outputLimit(stderr),
      note: "تم تنفيذ البناء داخل Firecracker microVM مؤقتة. لم يتم نشر المشروع ولم يتم منحه مفاتيح أو أسراراً.",
    }, { status: build.exitCode === 0 ? 200 : 422 });
  } catch (error) {
    const message = error instanceof Error ? error.message : "تعذر تشغيل بيئة التنفيذ المعزولة.";
    return NextResponse.json({
      ok: false,
      phase,
      error: message,
      note: "تحقق من أن الطلب يعمل على Vercel وأن Sandbox متاح للمشروع.",
    }, { status: 502 });
  } finally {
    if (sandbox) {
      await sandbox.stop().catch(() => undefined);
    }
  }
}
