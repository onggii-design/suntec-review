import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import Anthropic from "@anthropic-ai/sdk";

const anthropic = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });

async function sendTelegram(msg: string) {
  const token = process.env.TELEGRAM_BOT_TOKEN;
  const chatId = process.env.TELEGRAM_CHAT_ID;
  if (!token || !chatId) return;
  await fetch(`https://api.telegram.org/bot${token}/sendMessage`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ chat_id: chatId, text: msg, parse_mode: "HTML" }),
  });
}

export async function GET(request: Request) {
  const authHeader = request.headers.get("authorization");
  if (authHeader !== `Bearer ${process.env.CRON_SECRET}`) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const supabase = createClient();
  const oneWeekAgo = new Date();
  oneWeekAgo.setDate(oneWeekAgo.getDate() - 7);

  const { data: weekReviews } = await supabase
    .from("reviews")
    .select("rating, reply_status, comment, location_id, locations(name)")
    .gte("review_created_at", oneWeekAgo.toISOString());

  const { data: allTimeData } = await supabase
    .rpc("get_location_avg_ratings") as { data: { location_id: string; avg_rating: string; total_count: string }[] | null, error: unknown };

  const allTimeMap: Record<string, { avg: number; count: number }> = {};
  for (const r of allTimeData ?? []) {
    allTimeMap[r.location_id] = { avg: parseFloat(r.avg_rating), count: Number(r.total_count) };
  }

  type LocData = { name: string; ratings: number[]; bad: number; replied: number; comments: string[] };
  const byLocation: Record<string, LocData> = {};

  for (const review of weekReviews ?? []) {
    const loc = review.locations as { name: string } | null;
    const name = loc?.name ?? "Unknown";
    const lid = review.location_id;
    if (!byLocation[lid]) byLocation[lid] = { name, ratings: [], bad: 0, replied: 0, comments: [] };
    byLocation[lid].ratings.push(review.rating);
    if (review.rating <= 3) byLocation[lid].bad++;
    if (review.reply_status === "published") byLocation[lid].replied++;
    if (review.comment) byLocation[lid].comments.push(`[${review.rating}★] ${review.comment}`);
  }

  const total = (weekReviews ?? []).length;
  const totalReplied = (weekReviews ?? []).filter(r => r.reply_status === "published").length;
  const replyRate = total > 0 ? Math.round((totalReplied / total) * 100) : 0;

  const now = new Date();
  const weekStart = new Date(now); weekStart.setDate(now.getDate() - 7);
  const fmt = (d: Date) => d.toLocaleDateString("en-SG", { day: "numeric", month: "short" });

  let msg1 = `📊 <b>Weekly Review Report</b>\n${fmt(weekStart)} – ${fmt(now)}\n\n`;
  for (const [lid, loc] of Object.entries(byLocation)) {
    const weekAvg = loc.ratings.length > 0 ? (loc.ratings.reduce((a, b) => a + b, 0) / loc.ratings.length).toFixed(1) : "N/A";
    const allTime = allTimeMap[lid];
    const allAvg = allTime ? allTime.avg.toFixed(1) : "N/A";
    msg1 += `🏪 <b>${loc.name}</b>\n`;
    msg1 += `⭐ This week: ${weekAvg} | All-time: ${allAvg}\n`;
    msg1 += `📝 Reviews this week: ${loc.ratings.length}\n`;
    msg1 += `😡 Bad reviews (1-3★): ${loc.bad}\n\n`;
  }
  msg1 += `📌 Overall reply rate: ${replyRate}%`;
  await sendTelegram(msg1);

  for (const loc of Object.values(byLocation)) {
    if (loc.comments.length === 0) continue;
    const sample = loc.comments.slice(0, 20).join("\n");
    const aiRes = await anthropic.messages.create({
      model: "claude-sonnet-4-6",
      max_tokens: 400,
      messages: [{
        role: "user",
        content: `You are analysing Google reviews for ${loc.name}, a Korean restaurant in Singapore.

Here are this week's reviews:
${sample}

Write a summary under 200 words total with exactly this format:
🔴 Top Concerns:
- [concern 1]
- [concern 2]

🟢 Top Praises:
- [praise 1]
- [praise 2]

🚨 Action Needed:
- [specific action 1]
- [specific action 2]

Be specific and actionable. No intro or outro text.`
      }]
    });

    const summary = aiRes.content[0].type === "text" ? aiRes.content[0].text.trim() : "";
    await sendTelegram(`🏪 <b>${loc.name} — Weekly Insights</b>\n\n${summary}`);
  }

  return NextResponse.json({ ok: true, locations: Object.keys(byLocation), total });
}
