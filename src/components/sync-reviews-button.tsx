"use client";

import { useState } from "react";

import { Button } from "@/components/ui/button";

type SyncReviewsResult = {
  synced: number;
  new: number;
  errors: string[];
};

export function SyncReviewsButton() {
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState<SyncReviewsResult | null>(null);
  const [error, setError] = useState<string | null>(null);

  async function handleSync() {
    setLoading(true);
    setError(null);
    setResult(null);

    try {
      const response = await fetch("/api/google/sync-reviews", {
        method: "POST",
      });
      const data = (await response.json()) as SyncReviewsResult & {
        error?: string;
      };

      if (!response.ok) {
        throw new Error(data.error ?? "Failed to sync reviews");
      }

      setResult(data);
    } catch (syncError) {
      setError(
        syncError instanceof Error
          ? syncError.message
          : "Failed to sync reviews"
      );
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="flex w-full max-w-md flex-col items-center gap-3">
      <Button onClick={handleSync} disabled={loading}>
        {loading ? "Syncing..." : "Sync now"}
      </Button>

      {error ? (
        <p className="text-sm text-destructive" role="alert">
          {error}
        </p>
      ) : null}

      {result ? (
        <div className="w-full rounded-lg border p-4 text-sm">
          <p>Synced: {result.synced}</p>
          <p>New: {result.new}</p>
          {result.errors.length > 0 ? (
            <ul className="mt-2 list-disc space-y-1 pl-5 text-destructive">
              {result.errors.map((item) => (
                <li key={item}>{item}</li>
              ))}
            </ul>
          ) : (
            <p className="mt-2 text-muted-foreground">No errors.</p>
          )}
        </div>
      ) : null}
    </div>
  );
}
