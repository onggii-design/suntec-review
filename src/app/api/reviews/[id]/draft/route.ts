import Anthropic from "@anthropic-ai/sdk";
import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";

const anthropic = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });

export async function POST(
  _req: Request,
  { params }: { params: { id: string } }
) {
  const session = await getServerSession(authOptions);
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const supabase = createClient();
  const { data: review, error } = await supabase
    .from("reviews")
    .select("*, locations(name, brands(name))")
    .eq("id", params.id)
    .single();

  if (error || !review) {
    return NextResponse.json({ error: "Review not found" }, { status: 404 });
  }

  const loc = review.locations as { name: string; brands: { name: string } } | null;
  const locationName = loc?.name ?? "";
  const rating = review.rating;
  const comment = review.comment && review.comment.trim() !== "" ? review.comment.trim() : null;
  const reviewerName = review.reviewer_name ?? "Valued Guest";

  const prompt = `You are writing Google review replies for Onggii, a Korean restaurant in Singapore specialising in Korean soups, gomtang, and traditional Korean stews. Onggii is NOT a Korean BBQ restaurant.

Location: ${locationName}
Rating: ${rating}/5 stars
Reviewer name: ${reviewerName}
Review text: ${comment ? `"${comment}"` : "NONE - customer left stars only with no written comment."}

BRAND VOICE:
- Warm, personal and genuine - not corporate or robotic
- Concise and easy to read - short paragraphs, not walls of text
- Specific - always reference what the customer actually mentioned (dishes, experience)
- Proud of identity - Korean soups, gomtang, Korean comfort food
- Never over-apologetic or needy

FORMAT RULES:
- Always start with "Hi [reviewer name]," on its own line
- Blank line between paragraphs
- Keep each paragraph to 2-3 sentences max
- End with "The Onggii Team" on its own line
- Use one emoji after the first thank you line, and one at the end before sign-off
- Never use hashtags

SAMPLE REPLIES:

Positive (5 stars, no comment):
Hi Beverly,
Thank you for your kind review! 😊
We're glad you enjoyed your experience at Onggii ${locationName}, your Korean restaurant in Singapore specialising in hearty gomtang and traditional Korean stews.
We look forward to welcoming you again soon! 🫰
The Onggii Team

Positive (5 stars, with specific dish):
Hi Amanda,
Thank you so much for your wonderful review! 😊
We're delighted to hear that you enjoyed your meal at Onggii. It means a lot to us that the Wang Galbi Gomtang and Kimchi Jeon were among your favourites.
Your kind words encourage our team to keep serving authentic Korean comfort food. We look forward to welcoming you back to Onggii again soon! 🫰
The Onggii Team

Negative (1-3 stars):
Dear Valued Guest,
Thank you for your feedback and for dining with us at Onggii.
We're sorry to hear that this visit did not meet your expectations. Your comments have been shared with our team as we continue to improve our service and dining experience.
We hope to welcome you back again soon.
The Onggii Team

RULES FOR NO COMMENT (stars only):
- Write a short thank you
- Mention Onggii specialises in Korean soups and gomtang
- Do NOT make up details about their visit
- Keep it under 4 lines

RULES FOR NEGATIVE REVIEWS:
- Acknowledge frustration without being overly apologetic
- This is rare feedback - do not make it sound like the restaurant is failing
- Say feedback will be shared with the team
- Do not beg or sound needy

RULES FOR POSITIVE WITH COMMENTS:
- Reference specific dishes or experience they mentioned
- Never mention Korean BBQ

Write the reply now:`;

  // Fetch recent published replies to learn from
  const { data: publishedReplies } = await supabase
    .from("reviews")
    .select("rating, comment, reply_text")
    .eq("reply_status", "published")
    .not("reply_text", "is", null)
    .not("comment", "is", null)
    .order("replied_at", { ascending: false })
    .limit(15);

  const examples = (publishedReplies ?? [])
    .map(r => `Review (${r.rating}★): "${r.comment}"\nReply: "${r.reply_text}"`)
    .join("\n\n---\n\n");

  const examplesSection = examples ? `\n\nHere are recent real replies we have published - learn from these to match our exact tone and style:\n\n${examples}` : "";

  const message = await anthropic.messages.create({
    model: "claude-sonnet-4-6",
    max_tokens: 1024,
    messages: [{ role: "user", content: prompt + examplesSection }],
  });

  const draft = message.content[0].type === "text" ? message.content[0].text.trim() : "";

  await supabase
    .from("reviews")
    .update({ reply_text: draft, reply_status: "draft" })
    .eq("id", params.id);

  return NextResponse.json({ draft });
}
