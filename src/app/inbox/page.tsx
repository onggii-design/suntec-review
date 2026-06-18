import { getServerSession } from "next-auth";
import { redirect } from "next/navigation";

import { InboxClient } from "@/components/inbox-client";
import { authOptions } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
import type { ReplyStatus } from "@/lib/supabase/types";

export type InboxReview = {
  id: string;
  google_review_id: string;
  reviewer_name: string | null;
  rating: number;
  comment: string | null;
  review_created_at: string;
  reply_text: string | null;
  reply_status: ReplyStatus;
  replied_at: string | null;
  location_name: string;
  brand_name: string;
};

export default async function InboxPage() {
  const session = await getServerSession(authOptions);
  if (!session) redirect("/login");

  const supabase = createClient();
  const { data, error } = await supabase
    .from("reviews")
    .select(`id, google_review_id, reviewer_name, rating, comment, review_created_at, reply_text, reply_status, replied_at, locations(name, brands(name))`)
    .order("review_created_at", { ascending: false });

  if (error) {
    return (
      <div className="flex min-h-screen items-center justify-center p-8">
        <p className="text-sm text-destructive">Failed to load reviews: {error.message}</p>
      </div>
    );
  }

  const reviews: InboxReview[] = (data ?? []).map((row) => {
    const loc = row.locations as { name: string; brands: { name: string } } | null;
    return {
      id: row.id,
      google_review_id: row.google_review_id,
      reviewer_name: row.reviewer_name,
      rating: row.rating,
      comment: row.comment,
      review_created_at: row.review_created_at,
      reply_text: row.reply_text,
      reply_status: row.reply_status as ReplyStatus,
      replied_at: row.replied_at,
      location_name: loc?.name ?? "Unknown location",
      brand_name: loc?.brands?.name ?? "Unknown brand",
    };
  });

  return <InboxClient reviews={reviews} />;
}
