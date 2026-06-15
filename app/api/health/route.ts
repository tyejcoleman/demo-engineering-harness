import { NextResponse } from "next/server";

export const runtime = "nodejs";

export async function GET() {
  return NextResponse.json({
    ok: true,
    service: "forge-demo-harness",
    slice: 0,
    ts: new Date().toISOString(),
  });
}
