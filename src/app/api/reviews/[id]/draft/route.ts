import Anthropic from "@anthropic-ai/sdk";
import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";

const anthropic = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });

export async function POST(_req: Request, { params }: { params: { id: string } }) {
  const session = await getServerSession(authOptions);
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const supabase = createClient();
  const { data: review, error } = await supabase.from("reviews").select("*, locations(name, brands(name))").eq("id", params.id).single();

  if (error || !review) return NextResponse.json({ error: "Review not found" }, { status: 404 });

  const loc = review.locations as { name: string; brands: { name: string } } | null;
  const brandName = loc?.brands?.name ?? "our restaurant";
  const locationName = loc?.name ?? "";
  const reviewerName = review.reviewer_name ?? "Valued Guest";

  const message = await anthropic.messages.create({
    model: "claude-sonnet-4-6",
    max_tokens: 1024,
    messages: [{ role: "user", content: "You are a friendly restaurant manager for " + brandName + " (" + locationName + ") in Singapore. Write a warm reply under 100 words to this " + review.rating + "/5 star review: " + (review.comment ?? "") + ". Sign off as The " + brandName + " Team. No hashtags or emojis." }],
  });

  const draft = message.content[0].type === "text" ? message.content[0].text.trim() : "";
  await supabase.from("reviews").update({ reply_text: draft, reply_status: "draft" }).eq("id", params.id);
  return NextResponse.json({ draft });
}
