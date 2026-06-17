import { NextResponse } from "next/server";

export function isAuthorizedCron(request: Request): boolean {
  const authHeader = request.headers.get("authorization");
  const cronSecret = process.env.CRON_SECRET;

  return Boolean(cronSecret && authHeader === `Bearer ${cronSecret}`);
}

export function unauthorizedCronResponse() {
  return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
}
