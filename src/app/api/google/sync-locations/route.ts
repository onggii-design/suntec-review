import { NextResponse } from "next/server";

import {
  getAuthenticatedSession,
  unauthorizedResponse,
} from "@/lib/auth-server";
import { fetchGoogleBusinessLocations } from "@/lib/google/business-profile";

export async function POST() {
  const session = await getAuthenticatedSession();

  if (!session) {
    return unauthorizedResponse();
  }

  try {
    const locations = await fetchGoogleBusinessLocations(session.accessToken!);

    return NextResponse.json({ locations });
  } catch (error) {
    console.error("Failed to sync Google Business locations:", error);

    const message =
      error instanceof Error
        ? error.message
        : "Failed to fetch Google Business Profile locations";

    return NextResponse.json({ error: message }, { status: 500 });
  }
}
