"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";

import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardFooter,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import type { BrandName, GoogleLocationSummary } from "@/lib/google/types";

type LocationRow = GoogleLocationSummary & {
  brand: BrandName | "";
};

export function SetupClient() {
  const router = useRouter();
  const [locations, setLocations] = useState<LocationRow[]>([]);
  const [fetching, setFetching] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleFetchLocations() {
    setFetching(true);
    setError(null);

    try {
      const response = await fetch("/api/google/sync-locations", {
        method: "POST",
      });
      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error ?? "Failed to fetch locations");
      }

      setLocations(
        (data.locations as GoogleLocationSummary[]).map((location) => ({
          ...location,
          brand: "",
        }))
      );
    } catch (fetchError) {
      setError(
        fetchError instanceof Error
          ? fetchError.message
          : "Failed to fetch locations"
      );
    } finally {
      setFetching(false);
    }
  }

  function updateBrand(googleLocationId: string, brand: BrandName | null) {
    setLocations((current) =>
      current.map((location) =>
        location.googleLocationId === googleLocationId
          ? { ...location, brand: brand ?? "" }
          : location
      )
    );
  }

  async function handleSave() {
    const unassigned = locations.some((location) => !location.brand);

    if (unassigned) {
      setError("Assign Onggii or Sotpot to every location before saving.");
      return;
    }

    setSaving(true);
    setError(null);

    try {
      const response = await fetch("/api/google/save-locations", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          locations: locations.map((location) => ({
            googleLocationId: location.googleLocationId,
            name: location.name,
            address: location.address,
            brand: location.brand,
          })),
        }),
      });
      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error ?? "Failed to save locations");
      }

      router.push("/inbox");
    } catch (saveError) {
      setError(
        saveError instanceof Error
          ? saveError.message
          : "Failed to save locations"
      );
    } finally {
      setSaving(false);
    }
  }

  return (
    <Card className="w-full max-w-3xl">
      <CardHeader>
        <CardTitle>Connect Google Business locations</CardTitle>
        <CardDescription>
          Fetch your Google Business Profile locations, assign each one to
          Onggii or Sotpot, then save them to Supabase.
        </CardDescription>
      </CardHeader>

      <CardContent className="space-y-6">
        <Button onClick={handleFetchLocations} disabled={fetching || saving}>
          {fetching ? "Fetching..." : "Fetch my locations"}
        </Button>

        {error ? (
          <p className="text-sm text-destructive" role="alert">
            {error}
          </p>
        ) : null}

        {locations.length > 0 ? (
          <ul className="space-y-4">
            {locations.map((location) => (
              <li
                key={location.googleLocationId}
                className="flex flex-col gap-3 rounded-lg border p-4 sm:flex-row sm:items-center sm:justify-between"
              >
                <div className="space-y-1">
                  <p className="font-medium">{location.name}</p>
                  <p className="text-sm text-muted-foreground">
                    {location.address ?? "No address provided"}
                  </p>
                </div>

                <Select
                  value={location.brand || null}
                  onValueChange={(value) =>
                    updateBrand(location.googleLocationId, value as BrandName)
                  }
                >
                  <SelectTrigger className="w-full sm:w-40">
                    <SelectValue placeholder="Select brand" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="Onggii">Onggii</SelectItem>
                    <SelectItem value="Sotpot">Sotpot</SelectItem>
                  </SelectContent>
                </Select>
              </li>
            ))}
          </ul>
        ) : null}
      </CardContent>

      {locations.length > 0 ? (
        <CardFooter>
          <Button onClick={handleSave} disabled={saving || fetching}>
            {saving ? "Saving..." : "Save"}
          </Button>
        </CardFooter>
      ) : null}
    </Card>
  );
}
