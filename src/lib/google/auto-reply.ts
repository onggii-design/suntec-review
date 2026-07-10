import Anthropic from "@anthropic-ai/sdk";

import { GoogleAccessTokenProvider } from "@/lib/google/oauth";
import { postReviewReply } from "@/lib/google/reply";
import { createClient } from "@/lib/supabase/server";

const anthropic = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });

function buildPrompt(
  locationName: string,
  rating: number,
  reviewerName: string,
  comment: string | null
): string {
  return `You are writing Google review replies for Onggii, a Korean restaurant in Singapore specialising in Korean soups, gomtang, and traditional Korean stews. Onggii is NOT a Korean BBQ restaurant.

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

RULES FOR NO COMMENT (stars only):
- Write a short thank you
- Mention Onggii specialises in Korean soups and gomtang
- Do NOT make up details about their visit
- Keep it under 4 lines

RULES FOR POSITIVE WITH COMMENTS:
- Reference specific dishes or experience they mentioned
- Never mention Korean BBQ

Write the reply now:`;
}

export async function autoReplyToGoodReviews(
  tokenProvider: GoogleAccessTokenProvider,
  googleReviewIds: string[],
  locationName: string,
  errors: string[]
): Promise<number> {
  if (googleReviewIds.length === 0) return 0;

  const supabase = createClient();

  const { data: reviews, error } = await supabase
    .from("reviews")
    .select("id, google_review_id, rating, comment, reviewer_name")
    .in("google_review_id", googleReviewIds)
    .gte("rating", 4);

  if (error || !reviews?.length) return 0;

  // Fetch recent published replies as few-shot examples
  const { data: publishedReplies } = await supabase
    .from("reviews")
    .select("rating, comment, reply_text")
    .eq("reply_status", "published")
    .not("reply_text", "is", null)
    .not("comment", "is", null)
    .order("replied_at", { ascending: false })
    .limit(15);

  const examples = (publishedReplies ?? [])
    .map((r) => `Review (${r.rating}★): "${r.comment}"\nReply: "${r.reply_text}"`)
    .join("\n\n---\n\n");

  const examplesSection = examples
    ? `\n\nHere are recent real replies we have published - learn from these to match our exact tone and style:\n\n${examples}`
    : "";

  let autoReplied = 0;

  for (const review of reviews) {
    try {
      const reviewerName = review.reviewer_name ?? "Valued Guest";
      const comment = review.comment?.trim() || null;
      const prompt = buildPrompt(locationName, review.rating, reviewerName, comment);

      const message = await anthropic.messages.create({
        model: "claude-sonnet-4-6",
        max_tokens: 1024,
        messages: [{ role: "user", content: prompt + examplesSection }],
      });

      const replyText =
        message.content[0].type === "text" ? message.content[0].text.trim() : "";

      if (!replyText) continue;

      await postReviewReply(tokenProvider, review.google_review_id, replyText);

      await supabase
        .from("reviews")
        .update({
          reply_text: replyText,
          reply_status: "published",
          replied_at: new Date().toISOString(),
        })
        .eq("id", review.id);

      autoReplied++;
    } catch (err) {
      const msg = err instanceof Error ? err.message : "Unknown error";
      errors.push(`Auto-reply failed for review ${review.id} (${locationName}): ${msg}`);
    }
  }

  return autoReplied;
}
