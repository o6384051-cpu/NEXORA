import { NextResponse } from "next/server";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const providers = ["openai", "google", "anthropic"] as const;
type Provider = (typeof providers)[number];

export async function GET() {
  // AI Gateway exposes one configured server-side provider route; never expose its key.
  const gatewayConfigured = Boolean(process.env.AI_GATEWAY_API_KEY);
  const configured = process.env.AI_PROVIDER || "openai";
  const defaultProvider: Provider = gatewayConfigured
    ? "openai"
    : providers.includes(configured as Provider)
      ? configured as Provider
      : "openai";
  const configuredProviders = gatewayConfigured
    ? ["openai"]
    : providers.filter((provider) => {
        if (provider === "google") return Boolean(process.env.GOOGLE_API_KEY);
        if (provider === "anthropic") return Boolean(process.env.ANTHROPIC_API_KEY);
        return Boolean(process.env.OPENAI_API_KEY);
      });

  // Public capability metadata only. Never return credentials, model secrets, or environment values.
  return NextResponse.json(
    { defaultProvider, configuredProviders },
    { headers: { "Cache-Control": "no-store, max-age=0" } },
  );
}
