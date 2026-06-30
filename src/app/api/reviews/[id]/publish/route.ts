import { NextResponse } from "next/server";

import { getAuthenticatedSession, unauthorizedResponse } from "@/lib/auth-server";
import { GoogleAccessTokenProvider } from "@/lib/google/oauth";
import { postReviewReply } from "@/lib/google/reply";
import { createClient } from "@/lib/supabase/server";

export async function POST(
  request: Request,
  { params }: { params: { id: string } }
) {
  const session = await getAuthenticatedSession();
  if (!session?.accessToken) return unauthorizedResponse();

  let body: { reply_text?: string };
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Invalid request body" }, { status: 400 });
  }

  const { reply_text } = body;
  if (!reply_text?.trim()) {
    return NextResponse.json({ error: "Reply text is required" }, { status: 400 });
  }

  const supabase = createClient();
  const { data: review, error: reviewError } = await supabase
    .from("reviews")
    .select("google_review_id")
    .eq("id", params.id)
    .single();

  if (reviewError || !review) {
    return NextResponse.json({ error: "Review not found" }, { status: 404 });
  }

  const tokenProvider = new GoogleAccessTokenProvider(
    session.accessToken,
    session.refreshToken
  );

  try {
    await postReviewReply(tokenProvider, review.google_review_id, reply_text);
  } catch (err) {
    console.error("postReviewReply failed", err);
    return NextResponse.json(
      { error: err instanceof Error ? err.message : "Failed to post reply to Google" },
      { status: 502 }
    );
  }

  const { error: updateError } = await supabase
    .from("reviews")
    .update({
      reply_text,
      reply_status: "published",
      replied_at: new Date().toISOString(),
    })
    .eq("id", params.id);

  if (updateError) {
    return NextResponse.json({ error: updateError.message }, { status: 500 });
  }

  return NextResponse.json({ ok: true });
}
