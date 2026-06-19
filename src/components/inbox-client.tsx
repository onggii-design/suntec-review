"use client";

import { formatDistanceToNow } from "date-fns";
import { CheckCircle, ChevronDown, ChevronUp, Loader2, Sparkles, Star } from "lucide-react";
import { useState } from "react";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { SignOutButton } from "@/components/sign-out-button";
import type { InboxReview } from "@/app/inbox/page";
import type { ReplyStatus } from "@/lib/supabase/types";

type FilterBrand = "all" | "onggii (Suntec City)" | "onggii (NEX)";
type FilterStatus = "all" | ReplyStatus;
type FilterRating = "all" | "1" | "2" | "3" | "4" | "5";

function StarRating({ rating }: { rating: number }) {
  return (
    <span className="flex items-center gap-0.5">
      {Array.from({ length: 5 }).map((_, i) => (
        <Star
          key={i}
          className={`h-3.5 w-3.5 ${i < rating ? "fill-amber-400 text-amber-400" : "text-muted-foreground/30"}`}
        />
      ))}
    </span>
  );
}

function StatusBadge({ status }: { status: ReplyStatus }) {
  const variants: Record<ReplyStatus, "default" | "secondary" | "outline"> = {
    pending: "default",
    draft: "secondary",
    published: "outline",
  };
  const labels: Record<ReplyStatus, string> = {
    pending: "Pending",
    draft: "Draft",
    published: "Published",
  };
  return <Badge variant={variants[status]}>{labels[status]}</Badge>;
}

type ReviewCardProps = {
  review: InboxReview;
  onUpdate: (id: string, updates: Partial<InboxReview>) => void;
};

function ReviewCard({ review, onUpdate }: ReviewCardProps) {
  const [expanded, setExpanded] = useState(false);
  const [replyText, setReplyText] = useState(review.reply_text ?? "");
  const [generating, setGenerating] = useState(false);
  const [saving, setSaving] = useState(false);
  const [publishing, setPublishing] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function generateDraft() {
    setGenerating(true);
    setError(null);
    try {
      const res = await fetch(`/api/reviews/${review.id}/draft`, { method: "POST" });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? "Failed to generate draft");
      setReplyText(data.draft);
      onUpdate(review.id, { reply_text: data.draft, reply_status: "draft" });
    } catch (e) {
      setError(e instanceof Error ? e.message : "Failed to generate draft");
    } finally {
      setGenerating(false);
    }
  }

  async function saveDraft() {
    setSaving(true);
    setError(null);
    try {
      const res = await fetch(`/api/reviews/${review.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ reply_text: replyText }),
      });
      if (!res.ok) {
        const data = await res.json();
        throw new Error(data.error ?? "Failed to save draft");
      }
      onUpdate(review.id, { reply_text: replyText, reply_status: "draft" });
    } catch (e) {
      setError(e instanceof Error ? e.message : "Failed to save draft");
    } finally {
      setSaving(false);
    }
  }

  async function publishReply() {
    if (!replyText.trim()) {
      setError("Reply text cannot be empty.");
      return;
    }
    setPublishing(true);
    setError(null);
    try {
      const res = await fetch(`/api/reviews/${review.id}/publish`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ reply_text: replyText }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? "Failed to publish reply");
      onUpdate(review.id, {
        reply_text: replyText,
        reply_status: "published",
        replied_at: new Date().toISOString(),
      });
    } catch (e) {
      setError(e instanceof Error ? e.message : "Failed to publish reply");
    } finally {
      setPublishing(false);
    }
  }

  const busy = generating || saving || publishing;

  return (
    <Card className="overflow-hidden">
      <button
        className="w-full text-left"
        onClick={() => setExpanded((v) => !v)}
        aria-expanded={expanded}
      >
        <CardContent className="flex items-start gap-4 p-4">
          <div className="flex-1 space-y-1 min-w-0">
            <div className="flex flex-wrap items-center gap-2">
              <span className="font-medium text-sm">
                {review.reviewer_name ?? "Anonymous"}
              </span>
              <StarRating rating={review.rating} />
              <StatusBadge status={review.reply_status} />
            </div>
            <p className="text-xs text-muted-foreground">
              {review.location_name} · {review.brand_name} ·{" "}
              {formatDistanceToNow(new Date(review.review_created_at), { addSuffix: true })}
            </p>
            {review.comment && (
              <p className="text-sm text-foreground/80 line-clamp-2 mt-1">
                {review.comment}
              </p>
            )}
          </div>
          <span className="text-muted-foreground mt-1 shrink-0">
            {expanded ? <ChevronUp className="h-4 w-4" /> : <ChevronDown className="h-4 w-4" />}
          </span>
        </CardContent>
      </button>

      {expanded && (
        <div className="border-t px-4 pb-4 pt-3 space-y-3">
          {review.comment && (
            <div>
              <p className="text-xs font-medium text-muted-foreground mb-1">Review</p>
              <p className="text-sm">{review.comment}</p>
            </div>
          )}

          <div className="space-y-2">
            <p className="text-xs font-medium text-muted-foreground">Reply</p>
            <Textarea
              value={replyText}
              onChange={(e) => setReplyText(e.target.value)}
              placeholder="Write a reply..."
              rows={4}
              disabled={review.reply_status === "published" || busy}
              className="resize-none text-sm"
            />
          </div>

          {error && (
            <p className="text-xs text-destructive" role="alert">{error}</p>
          )}

          {review.reply_status !== "published" ? (
            <div className="flex flex-wrap gap-2">
              <Button
                size="sm"
                variant="outline"
                onClick={generateDraft}
                disabled={busy}
              >
                {generating ? (
                  <Loader2 className="h-3.5 w-3.5 mr-1.5 animate-spin" />
                ) : (
                  <Sparkles className="h-3.5 w-3.5 mr-1.5" />
                )}
                {generating ? "Generating..." : "Generate draft"}
              </Button>

              <Button
                size="sm"
                variant="secondary"
                onClick={saveDraft}
                disabled={busy || !replyText.trim()}
              >
                {saving ? <Loader2 className="h-3.5 w-3.5 mr-1.5 animate-spin" /> : null}
                {saving ? "Saving..." : "Save draft"}
              </Button>

              <Button
                size="sm"
                onClick={publishReply}
                disabled={busy || !replyText.trim()}
              >
                {publishing ? (
                  <Loader2 className="h-3.5 w-3.5 mr-1.5 animate-spin" />
                ) : (
                  <CheckCircle className="h-3.5 w-3.5 mr-1.5" />
                )}
                {publishing ? "Publishing..." : "Publish"}
              </Button>
            </div>
          ) : (
            <div className="flex items-center gap-1.5 text-xs text-muted-foreground">
              <CheckCircle className="h-3.5 w-3.5 text-green-500" />
              Published{review.replied_at ? ` ${formatDistanceToNow(new Date(review.replied_at), { addSuffix: true })}` : ""}
            </div>
          )}
        </div>
      )}
    </Card>
  );
}

export function InboxClient({ reviews: initial }: { reviews: InboxReview[] }) {
  const [reviews, setReviews] = useState(initial);
  const [brand, setBrand] = useState<FilterBrand>("all");
  const [status, setStatus] = useState<FilterStatus>("all");
  const [rating, setRating] = useState<FilterRating>("all");
  const [syncing, setSyncing] = useState(false);
  const [syncMsg, setSyncMsg] = useState<string | null>(null);

  async function handleSync() {
    setSyncing(true);
    setSyncMsg(null);
    try {
      const res = await fetch("/api/google/sync-reviews", { method: "POST" });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? "Sync failed");
      setSyncMsg(`Synced ${data.synced} reviews (${data.new} new)`);
      window.location.reload();
    } catch (e) {
      setSyncMsg(e instanceof Error ? e.message : "Sync failed");
    } finally {
      setSyncing(false);
    }
  }

  function handleUpdate(id: string, updates: Partial<InboxReview>) {
    setReviews((prev) => prev.map((r) => (r.id === id ? { ...r, ...updates } : r)));
  }

  const filtered = reviews.filter((r) => {
    if (brand !== "all" && r.location_name !== brand) return false;
    if (status !== "all" && r.reply_status !== status) return false;
    if (rating !== "all" && r.rating !== Number(rating)) return false;
    return true;
  });

  const pendingCount = reviews.filter((r) => r.reply_status === "pending").length;

  return (
    <div className="min-h-screen bg-background">
      <div className="mx-auto max-w-2xl px-4 py-8 space-y-6">
        <div className="flex items-center justify-between gap-4">
          <div className="space-y-0.5">
            <h1 className="text-xl font-semibold">Inbox</h1>
            {pendingCount > 0 && (
              <p className="text-sm text-muted-foreground">
                {pendingCount} review{pendingCount !== 1 ? "s" : ""} awaiting reply
              </p>
            )}
          </div>
          <div className="flex items-center gap-2">
            <Button size="sm" variant="outline" onClick={handleSync} disabled={syncing}>
              {syncing ? <Loader2 className="h-3.5 w-3.5 mr-1.5 animate-spin" /> : null}
              {syncing ? "Syncing..." : "Sync"}
            </Button>
            <SignOutButton />
          </div>
        </div>
        {syncMsg && (
          <p className="text-xs text-muted-foreground">{syncMsg}</p>
        )}

        <div className="flex flex-wrap gap-2">
          <Select value={brand} onValueChange={(v) => setBrand(v as FilterBrand)}>
            <SelectTrigger className="w-32 h-8 text-xs">
              <SelectValue placeholder="Brand" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All locations</SelectItem>
              <SelectItem value="onggii (Suntec City)">Onggii Suntec City</SelectItem>
              <SelectItem value="onggii (NEX)">Onggii NEX</SelectItem>
            </SelectContent>
          </Select>

          <Select value={status} onValueChange={(v) => setStatus(v as FilterStatus)}>
            <SelectTrigger className="w-32 h-8 text-xs">
              <SelectValue placeholder="Status" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All statuses</SelectItem>
              <SelectItem value="pending">Pending</SelectItem>
              <SelectItem value="draft">Draft</SelectItem>
              <SelectItem value="published">Published</SelectItem>
            </SelectContent>
          </Select>

          <Select value={rating} onValueChange={(v) => setRating(v as FilterRating)}>
            <SelectTrigger className="w-28 h-8 text-xs">
              <SelectValue placeholder="Rating" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All ratings</SelectItem>
              {[1, 2, 3, 4, 5].map((n) => (
                <SelectItem key={n} value={String(n)}>
                  {n} star{n !== 1 ? "s" : ""}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        {filtered.length === 0 ? (
          <p className="text-sm text-muted-foreground py-12 text-center">
            No reviews match your filters.
          </p>
        ) : (
          <div className="space-y-3">
            {filtered.map((review) => (
              <ReviewCard key={review.id} review={review} onUpdate={handleUpdate} />
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
