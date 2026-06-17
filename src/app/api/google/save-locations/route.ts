import { NextResponse } from "next/server";

import {
  getAuthenticatedSession,
  unauthorizedResponse,
} from "@/lib/auth-server";
import type { BrandName, SaveLocationsRequest } from "@/lib/google/types";
import { createClient } from "@/lib/supabase/server";

const BRAND_NAMES: BrandName[] = ["Onggii", "Sotpot"];

function isBrandName(value: string): value is BrandName {
  return BRAND_NAMES.includes(value as BrandName);
}

async function getBrandIdMap() {
  const supabase = createClient();
  const { data, error } = await supabase
    .from("brands")
    .select("id, name")
    .in("name", BRAND_NAMES);

  if (error) {
    throw new Error(error.message);
  }

  const brandIdByName = new Map<string, string>();

  for (const brand of data ?? []) {
    brandIdByName.set(brand.name, brand.id);
  }

  for (const brandName of BRAND_NAMES) {
    if (brandIdByName.has(brandName)) {
      continue;
    }

    const { data: created, error: createError } = await supabase
      .from("brands")
      .insert({ name: brandName })
      .select("id, name")
      .single();

    if (createError) {
      throw new Error(createError.message);
    }

    brandIdByName.set(created.name, created.id);
  }

  return brandIdByName;
}

export async function POST(request: Request) {
  const session = await getAuthenticatedSession();

  if (!session) {
    return unauthorizedResponse();
  }

  let body: SaveLocationsRequest;

  try {
    body = (await request.json()) as SaveLocationsRequest;
  } catch {
    return NextResponse.json({ error: "Invalid request body" }, { status: 400 });
  }

  if (!Array.isArray(body.locations) || body.locations.length === 0) {
    return NextResponse.json(
      { error: "At least one location is required" },
      { status: 400 }
    );
  }

  for (const location of body.locations) {
    if (
      !location.googleLocationId ||
      !location.name ||
      !location.brand ||
      !isBrandName(location.brand)
    ) {
      return NextResponse.json(
        { error: "Each location must include a brand assignment" },
        { status: 400 }
      );
    }
  }

  try {
    const brandIdByName = await getBrandIdMap();
    const supabase = createClient();

    const rows = body.locations.map((location) => ({
      google_location_id: location.googleLocationId,
      name: location.name,
      address: location.address,
      brand_id: brandIdByName.get(location.brand)!,
    }));

    const { data, error } = await supabase
      .from("locations")
      .upsert(rows, { onConflict: "google_location_id" })
      .select("id, google_location_id, name, brand_id");

    if (error) {
      throw new Error(error.message);
    }

    return NextResponse.json({ locations: data });
  } catch (error) {
    console.error("Failed to save locations:", error);

    const message =
      error instanceof Error ? error.message : "Failed to save locations";

    return NextResponse.json({ error: message }, { status: 500 });
  }
}
