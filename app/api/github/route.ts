import { NextResponse } from "next/server";
export const runtime="nodejs";
export async function GET() { return NextResponse.json({configured:Boolean(process.env.GITHUB_APP_ID&&process.env.GITHUB_APP_PRIVATE_KEY&&process.env.GITHUB_APP_INSTALLATION_ID),mode:"github-app",capabilities:["repository metadata","create branch","commit files","open pull request"],required:["GITHUB_APP_ID","GITHUB_APP_PRIVATE_KEY","GITHUB_APP_INSTALLATION_ID"],status:"credentials_required"}); }
