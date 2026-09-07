import { timingSafeEqual } from "node:crypto";
import { NextResponse } from "next/server";
import { z } from "zod";
import { createOwnerSession } from "@/server/session";

const Input = z.object({ accessKey: z.string().min(1) });

export async function POST(request: Request) {
  try {
    const { accessKey } = Input.parse(await request.json());
    const expected = process.env.LEDGER_ACCESS_KEY ?? "";
    const secret = process.env.LEDGER_SESSION_SECRET ?? "";
    const ownerId = Number(process.env.TELEGRAM_ALLOWED_USER_ID);
    const matches = accessKey.length === expected.length && expected.length > 0 && timingSafeEqual(Buffer.from(accessKey), Buffer.from(expected));
    if (!matches || secret.length < 16 || !Number.isSafeInteger(ownerId)) throw new Error("Invalid access key");
    const response = NextResponse.json({ ok: true });
    response.cookies.set("ledger_session", createOwnerSession(ownerId, secret), { httpOnly: true, sameSite: "strict", secure: process.env.NODE_ENV === "production", path: "/", maxAge: 60 * 60 * 24 * 30 });
    return response;
  } catch { return NextResponse.json({ error: "Invalid access key" }, { status: 401 }); }
}
