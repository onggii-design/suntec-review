import { GoogleAccessTokenProvider } from "@/lib/google/oauth";
import {
  buildLocationResourceNameLookup,
  fetchGoogleAccountNames,
  resolveFullLocationResourceName,
} from "@/lib/google/business-profile";
import {
  fetchLocationReviews,
  mapGoogleReviewToRow,
} from "@/lib/google/reviews";
import { createClient } from "@/lib/supabase/server";

export type SyncReviewsSummary = {
  synced: number;
  new: number;
  errors: string[];
};

export async function runSyncReviews(
  accessToken: string,
  refreshToken?: string
): Promise<SyncReviewsSummary> {
  const summary: SyncReviewsSummary = {
    synced: 0,
    new: 0,
    errors: [],
  };

  const supabase = createClient();
  const tokenProvider = new GoogleAccessTokenProvider(
    accessToken,
    refreshToken
  );

  const { data: locations, error: locationsError } = await supabase
    .from("locations")
    .select("id, google_location_id, name");

  if (locationsError) {
    throw new Error(locationsError.message);
  }

  if (!locations?.length) {
    return summary;
  }

  const accountNames = await fetchGoogleAccountNames(accessToken, refreshToken);
  const locationLookup = await buildLocationResourceNameLookup(
    accessToken,
    refreshToken
  );

  if (accountNames.length === 0) {
    summary.errors.push("No Google Business accounts found for this user.");
    return summary;
  }

  for (const location of locations) {
    try {
      const fullLocationPath = resolveFullLocationResourceName(
        location.google_location_id,
        accountNames,
        locationLookup
      );

      if (!fullLocationPath) {
        summary.errors.push(
          `${location.name}: could not resolve full Google location path for "${location.google_location_id}"`
        );
        continue;
      }

      const googleReviews = await fetchLocationReviews(
        tokenProvider,
        fullLocationPath
      );

      if (googleReviews.length === 0) {
        continue;
      }

      const rows = googleReviews
        .map((review) => mapGoogleReviewToRow(review, location.id))
        .filter((row): row is NonNullable<typeof row> => row !== null);

      if (rows.length < googleReviews.length) {
        summary.errors.push(
          `Skipped ${googleReviews.length - rows.length} invalid review(s) for ${location.name}`
        );
      }

      if (rows.length === 0) {
        continue;
      }

      const { data: existingReviews, error: existingError } = await supabase
        .from("reviews")
        .select("google_review_id")
        .eq("location_id", location.id);

      if (existingError) {
        summary.errors.push(
          `${location.name}: failed to check existing reviews (${existingError.message})`
        );
        continue;
      }

      const existingIds = new Set(
        (existingReviews ?? []).map((review) => review.google_review_id)
      );

      summary.new += rows.filter(
        (row) => !existingIds.has(row.google_review_id)
      ).length;

      const { error: upsertError } = await supabase
        .from("reviews")
        .upsert(rows, { onConflict: "google_review_id" });

      if (upsertError) {
        summary.errors.push(
          `${location.name}: failed to save reviews (${upsertError.message})`
        );
        continue;
      }

      summary.synced += rows.length;
    } catch (error) {
      const message =
        error instanceof Error ? error.message : "Unknown sync error";

      console.error(
        `Failed to sync reviews for location ${location.name}:`,
        error
      );

      summary.errors.push(`${location.name}: ${message}`);
    }
  }

  return summary;
}
