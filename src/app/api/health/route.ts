import { NextResponse } from "next/server";

export function GET() {
  return NextResponse.json({ ok: true, inference: "on-device-only" });
}
