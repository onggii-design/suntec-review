import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";

export async function GET(request: Request) {
  const authHeader = request.headers.get("authorization");
  if (authHeader !== `Bearer ${process.env.CRON_SECRET}`) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const supabase = createClient();
  const oneWeekAgo = new Date();
  oneWeekAgo.setDate(oneWeekAgo.getDate() - 7);

  const { data: reviews } = await supabase
    .from("reviews")
    .select("rating, reply_status, locations(name)")
    .gte("review_created_at", oneWeekAgo.toISOString());

  const byLocation: Record<string, { name: string; ratings: number[]; bad: number; replied: number }> = {};

  for (const review of reviews ?? []) {
    const loc = review.locations as { name: string } | null;
    const name = loc?.name ?? "Unknown";
    if (!byLocation[name]) byLocation[name] = { name, ratings: [], bad: 0, replied: 0 };
    byLocation[name].ratings.push(review.rating);
    if (review.rating <= 3) byLocation[name].bad++;
    if (review.reply_status === "published") byLocation[name].replied++;
  }

  const total = (reviews ?? []).length;
  const totalReplied = (reviews ?? []).filter(r => r.reply_status === "published").length;
  const replyRate = total > 0 ? Math.round((totalReplied / total) * 100) : 0;

  const now = new Date();
  const weekStart = new Date(now); weekStart.setDate(now.getDate() - 7);
  const fmt = (d: Date) => d.toLocaleDateString("en-SG", { day: "numeric", month: "short" });

  let msg = `📊 <b>Weekly Review Report</b>\n${fmt(weekStart)} – ${fmt(now)}\n\n`;

  for (const loc of Object.values(byLocation)) {
    const avg = loc.ratings.length > 0 ? (loc.ratings.reduce((a, b) => a + b, 0) / loc.ratings.length).toFixed(1) : "N/A";
    msg += `🏪 <b>${loc.name}</b>\n`;
    msg += `⭐ Avg rating: ${avg}\n`;
    msg += `📝 Reviews: ${loc.ratings.length}\n`;
    msg += `😡 Bad reviews (1-3★): ${loc.bad}\n\n`;
  }

  msg += `📌 Overall reply rate: ${replyRate}%`;

  const token = process.env.TELEGRAM_BOT_TOKEN;
  const chatId = process.env.TELEGRAM_CHAT_ID;
  if (token && chatId) {
    await fetch(`https://api.telegram.org/bot${token}/sendMessage`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ chat_id: chatId, text: msg, parse_mode: "HTML" }),
    });
  }

  return NextResponse.json({ ok: true, locations: Object.keys(byLocation), total });
}
