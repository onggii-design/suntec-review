import { google } from "googleapis";

export async function refreshGoogleAccessToken(
  refreshToken: string
): Promise<string> {
  const oauth2Client = new google.auth.OAuth2(
    process.env.GOOGLE_CLIENT_ID,
    process.env.GOOGLE_CLIENT_SECRET
  );

  oauth2Client.setCredentials({ refresh_token: refreshToken });

  const { credentials } = await oauth2Client.refreshAccessToken();

  if (!credentials.access_token) {
    throw new Error("Failed to refresh Google access token");
  }

  return credentials.access_token;
}

export class GoogleAccessTokenProvider {
  private accessToken: string;

  constructor(
    accessToken: string,
    private refreshToken?: string
  ) {
    this.accessToken = accessToken;
  }

  getAccessToken() {
    return this.accessToken;
  }

  async fetch(url: string, init?: RequestInit): Promise<Response> {
    let response = await this.authenticatedFetch(url, init);

    if (response.status === 401 && this.refreshToken) {
      this.accessToken = await refreshGoogleAccessToken(this.refreshToken);
      response = await this.authenticatedFetch(url, init);
    }

    return response;
  }

  private authenticatedFetch(url: string, init?: RequestInit) {
    return fetch(url, {
      ...init,
      headers: {
        ...init?.headers,
        Authorization: `Bearer ${this.accessToken}`,
      },
    });
  }
}
