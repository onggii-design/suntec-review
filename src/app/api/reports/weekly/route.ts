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
    .select("rating, reply_status, comment, locations(name)")
    .gte("review_created_at", oneWeekAgo.toISOString());

  const { data: allReviews } = await supabase
    .from("reviews")
    .select("rating, locations(name)");

  type LocData = { name: string; ratings: number[]; bad: number; replied: number; comments: string[]; allRatings: number[] };
  const byLocation: Record<string, LocData> = {};

  for (const review of weekReviews ?? []) {
    const loc = review.locations as { name: string } | null;
    const name = loc?.name ?? "Unknown";
    if (!byLocation[name]) byLocation[name] = { name, ratings: [], bad: 0, replied: 0, comments: [], allRatings: [] };
    byLocation[name].ratings.push(review.rating);
    if (review.rating <= 3) byLocation[name].bad++;
    if (review.reply_status === "published") byLocation[name].replied++;
    if (review.comment) byLocation[name].comments.push(`[${review.rating}★] ${review.comment}`);
  }

  for (const review of allReviews ?? []) {
    const loc = review.locations as { name: string } | null;
    const name = loc?.name ?? "Unknown";
    if (byLocation[name]) byLocation[name].allRatings.push(review.rating);
  }

  const total = (weekReviews ?? []).length;
  const totalReplied = (weekReviews ?? []).filter(r => r.reply_status === "published").length;
  const replyRate = total > 0 ? Math.round((totalReplied / total) * 100) : 0;

  const now = new Date();
  const weekStart = new Date(now); weekStart.setDate(now.getDate() - 7);
  const fmt = (d: Date) => d.toLocaleDateString("en-SG", { day: "numeric", month: "short" });

  let msg1 = `📊 <b>Weekly Review Report</b>\n${fmt(weekStart)} – ${fmt(now)}\n\n`;
  for (const loc of Object.values(byLocation)) {
    const weekAvg = loc.ratings.length > 0 ? (loc.ratings.reduce((a, b) => a + b, 0) / loc.ratings.length).toFixed(1) : "N/A";
    const allAvg = loc.allRatings.length > 0 ? (loc.allRatings.reduce((a, b) => a + b, 0) / loc.allRatings.length).toFixed(1) : "N/A";
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
Top Concerns:
- [concern 1]
- [concern 2]

Top Praises:
- [praise 1]
- [praise 2]

Action Recommended:
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
