import type { GoogleAccessTokenProvider } from "@/lib/google/oauth";

export async function postReviewReply(
  tokenProvider: GoogleAccessTokenProvider,
  googleReviewId: string,
  replyText: string
): Promise<void> {
  const resourcePath = googleReviewId.replace(/^\/+/, "");
  const url = `https://mybusiness.googleapis.com/v4/${resourcePath}/reply`;

  const response = await tokenProvider.fetch(url, {
    method: "PUT",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ comment: replyText }),
  });

  if (!response.ok) {
    const body = await response.text();
    throw new Error(`Google reply API error (${response.status}): ${body}`);
  }
}
