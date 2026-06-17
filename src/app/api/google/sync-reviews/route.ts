import { NextResponse } from "next/server";

import { getAuthenticatedSession, unauthorizedResponse } from "@/lib/auth-server";
import {
  isAuthorizedCron,
  unauthorizedCronResponse,
} from "@/lib/cron-auth";
import { refreshGoogleAccessToken } from "@/lib/google/oauth";
import { runSyncReviews } from "@/lib/google/sync-reviews";

async function resolveSyncCredentials(request: Request) {
  if (isAuthorizedCron(request)) {
    const refreshToken = process.env.GOOGLE_REFRESH_TOKEN;

    if (!refreshToken) {
      return {
        error: NextResponse.json(
          {
            error:
              "GOOGLE_REFRESH_TOKEN is required for scheduled cron sync. Sign in once locally, copy the refresh token from your session, and add it to Vercel env vars.",
          },
          { status: 500 }
        ),
      };
    }

    const accessToken = await refreshGoogleAccessToken(refreshToken);

    return {
      credentials: { accessToken, refreshToken },
    };
  }

  const session = await getAuthenticatedSession();

  if (!session?.accessToken) {
    return { error: unauthorizedResponse() };
  }

  return {
    credentials: {
      accessToken: session.accessToken,
      refreshToken: session.refreshToken,
    },
  };
}

async function handleSync(request: Request) {
  try {
    const resolved = await resolveSyncCredentials(request);

    if (resolved.error) {
      return resolved.error;
    }

    const summary = await runSyncReviews(
      resolved.credentials!.accessToken,
      resolved.credentials!.refreshToken
    );

    return NextResponse.json(summary);
  } catch (error) {
    console.error("Failed to sync reviews:", error);

    const message =
      error instanceof Error ? error.message : "Failed to sync reviews";

    return NextResponse.json({ error: message }, { status: 500 });
  }
}

export async function GET(request: Request) {
  if (!isAuthorizedCron(request)) {
    return unauthorizedCronResponse();
  }

  return handleSync(request);
}

export async function POST(request: Request) {
  if (isAuthorizedCron(request)) {
    return handleSync(request);
  }

  const session = await getAuthenticatedSession();

  if (!session?.accessToken) {
    return unauthorizedResponse();
  }

  return handleSync(request);
}
