import type { ReplyStatus } from "@/lib/supabase/types";

import type { GoogleAccessTokenProvider } from "./oauth";

type GoogleReviewReply = {
  comment?: string;
  updateTime?: string;
};

type GoogleReviewer = {
  displayName?: string;
};

export type GoogleReview = {
  name?: string;
  reviewId?: string;
  reviewer?: GoogleReviewer;
  starRating?: string;
  comment?: string;
  createTime?: string;
  reviewReply?: GoogleReviewReply;
};

type ListReviewsResponse = {
  reviews?: GoogleReview[];
  nextPageToken?: string;
};

const STAR_RATING_MAP: Record<string, number> = {
  ONE: 1,
  TWO: 2,
  THREE: 3,
  FOUR: 4,
  FIVE: 5,
  STAR_ONE: 1,
  STAR_TWO: 2,
  STAR_THREE: 3,
  STAR_FOUR: 4,
  STAR_FIVE: 5,
};

export function mapStarRating(starRating?: string): number | null {
  if (!starRating) {
    return null;
  }

  return STAR_RATING_MAP[starRating] ?? null;
}

export function mapGoogleReviewToRow(
  review: GoogleReview,
  locationId: string
): {
  location_id: string;
  google_review_id: string;
  reviewer_name: string | null;
  rating: number;
  comment: string | null;
  review_created_at: string;
  reply_text: string | null;
  reply_status: ReplyStatus;
  replied_at: string | null;
} | null {
  const googleReviewId = review.name ?? review.reviewId;
  const rating = mapStarRating(review.starRating);

  if (!googleReviewId || !review.createTime || rating === null) {
    return null;
  }

  const hasReply = Boolean(review.reviewReply?.comment);

  return {
    location_id: locationId,
    google_review_id: googleReviewId,
    reviewer_name: review.reviewer?.displayName ?? null,
    rating,
    comment: review.comment ?? null,
    review_created_at: review.createTime,
    reply_text: review.reviewReply?.comment ?? null,
    reply_status: hasReply ? "published" : "pending",
    replied_at: hasReply ? (review.reviewReply?.updateTime ?? null) : null,
  };
}

export function buildReviewsListUrl(
  locationResourceName: string,
  pageToken?: string
): string {
  const resourcePath = locationResourceName.replace(/^\/+/, "");
  const url = new URL("https://mybusiness.googleapis.com");
  url.pathname = `/v4/${resourcePath}/reviews`;
  url.searchParams.set("pageSize", "50");

  if (pageToken) {
    url.searchParams.set("pageToken", pageToken);
  }

  return url.toString();
}

export async function fetchLocationReviews(
  tokenProvider: GoogleAccessTokenProvider,
  locationName: string
): Promise<GoogleReview[]> {
  const reviews: GoogleReview[] = [];
  let pageToken: string | undefined;

  do {
    const requestUrl = buildReviewsListUrl(locationName, pageToken);
    const parsedUrl = new URL(requestUrl);

    console.log("[sync-reviews] Fetching Google reviews URL:", {
      pathname: parsedUrl.pathname,
      search: parsedUrl.search,
    });

    const response = await tokenProvider.fetch(requestUrl);

    if (!response.ok) {
      const errorBody = await response.text();
      throw new Error(
        `Google reviews API error (${response.status}): ${errorBody}`
      );
    }

    const data = (await response.json()) as ListReviewsResponse;

    reviews.push(...(data.reviews ?? []));
    pageToken = data.nextPageToken;
  } while (pageToken);

  return reviews;
}
