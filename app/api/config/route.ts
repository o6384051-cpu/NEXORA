import { NextResponse } from "next/server";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const providers = ["openai", "google", "anthropic"] as const;

export async function GET() {
  const configured = process.env.AI_PROVIDER || "openai";
  const defaultProvider = providers.includes(configured as (typeof providers)[number])
    ? configured
    : "openai";

  // This endpoint exposes only the provider identifier, never credentials or model secrets.
  return NextResponse.json(
    { defaultProvider },
    { headers: { "Cache-Control": "no-store, max-age=0" } },
  );
}
