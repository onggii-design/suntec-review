import { google } from "googleapis";
import type { mybusinessbusinessinformation_v1 } from "googleapis";

import type { GoogleLocationSummary } from "./types";

function createGoogleAuth(accessToken: string, refreshToken?: string) {
  const auth = new google.auth.OAuth2(
    process.env.GOOGLE_CLIENT_ID,
    process.env.GOOGLE_CLIENT_SECRET
  );
  auth.setCredentials({
    access_token: accessToken,
    refresh_token: refreshToken,
  });
  return auth;
}

export function extractLocationId(googleLocationId: string): string {
  const match = googleLocationId.match(/locations\/([^/]+)$/);
  return match ? match[1] : googleLocationId;
}

export function buildFullLocationResourceName(
  accountName: string,
  googleLocationId: string
): string {
  const accountId = accountName.replace(/^accounts\//, "");
  const locationId = extractLocationId(googleLocationId);
  return `accounts/${accountId}/locations/${locationId}`;
}

export function ensureFullLocationResourceName(
  locationResourceName: string,
  accountName: string
): string {
  if (locationResourceName.startsWith("accounts/")) {
    return locationResourceName;
  }

  return buildFullLocationResourceName(accountName, locationResourceName);
}

export async function fetchGoogleAccountNames(
  accessToken: string,
  refreshToken?: string
): Promise<string[]> {
  const auth = createGoogleAuth(accessToken, refreshToken);
  const accountManagement = google.mybusinessaccountmanagement({
    version: "v1",
    auth,
  });

  const accountNames: string[] = [];
  let pageToken: string | undefined;

  do {
    const response = await accountManagement.accounts.list({
      pageToken,
      pageSize: 20,
    });

    for (const account of response.data.accounts ?? []) {
      if (account.name) {
        accountNames.push(account.name);
      }
    }

    pageToken = response.data.nextPageToken ?? undefined;
  } while (pageToken);

  return accountNames;
}

export async function buildLocationResourceNameLookup(
  accessToken: string,
  refreshToken?: string
): Promise<Map<string, string>> {
  const auth = createGoogleAuth(accessToken, refreshToken);
  const accountManagement = google.mybusinessaccountmanagement({
    version: "v1",
    auth,
  });
  const businessInformation = google.mybusinessbusinessinformation({
    version: "v1",
    auth,
  });

  const lookup = new Map<string, string>();
  let accountPageToken: string | undefined;

  do {
    const accountsResponse = await accountManagement.accounts.list({
      pageToken: accountPageToken,
      pageSize: 20,
    });

    for (const account of accountsResponse.data.accounts ?? []) {
      if (!account.name) {
        continue;
      }

      let locationPageToken: string | undefined;

      do {
        const locationsResponse =
          await businessInformation.accounts.locations.list({
            parent: account.name,
            readMask: "name",
            pageToken: locationPageToken,
            pageSize: 100,
          });

        for (const location of locationsResponse.data.locations ?? []) {
          if (!location.name) {
            continue;
          }

          const locationId = extractLocationId(location.name);
          const fullName = ensureFullLocationResourceName(
            location.name,
            account.name
          );

          lookup.set(location.name, fullName);
          lookup.set(`locations/${locationId}`, fullName);
          lookup.set(locationId, fullName);
          lookup.set(fullName, fullName);
        }

        locationPageToken = locationsResponse.data.nextPageToken ?? undefined;
      } while (locationPageToken);
    }

    accountPageToken = accountsResponse.data.nextPageToken ?? undefined;
  } while (accountPageToken);

  return lookup;
}

export function resolveFullLocationResourceName(
  googleLocationId: string,
  accountNames: string[],
  locationLookup: Map<string, string>
): string | null {
  const directMatch = locationLookup.get(googleLocationId);
  if (directMatch) {
    return directMatch.startsWith("accounts/")
      ? directMatch
      : accountNames.length === 1
        ? buildFullLocationResourceName(accountNames[0], directMatch)
        : null;
  }

  const locationId = extractLocationId(googleLocationId);
  const suffixMatch =
    locationLookup.get(`locations/${locationId}`) ??
    locationLookup.get(locationId);

  if (suffixMatch) {
    return suffixMatch;
  }

  if (accountNames.length === 1) {
    return buildFullLocationResourceName(accountNames[0], googleLocationId);
  }

  return null;
}

function formatAddress(
  address?: mybusinessbusinessinformation_v1.Schema$PostalAddress | null
): string | null {
  if (!address) {
    return null;
  }

  const parts = [
    ...(address.addressLines ?? []),
    address.locality,
    address.administrativeArea,
    address.postalCode,
    address.regionCode,
  ].filter(Boolean);

  return parts.length > 0 ? parts.join(", ") : null;
}

export async function fetchGoogleBusinessLocations(
  accessToken: string
): Promise<GoogleLocationSummary[]> {
  const auth = createGoogleAuth(accessToken);

  const accountManagement = google.mybusinessaccountmanagement({
    version: "v1",
    auth,
  });
  const businessInformation = google.mybusinessbusinessinformation({
    version: "v1",
    auth,
  });

  const locations: GoogleLocationSummary[] = [];

  let accountPageToken: string | undefined;

  do {
    const accountsResponse = await accountManagement.accounts.list({
      pageToken: accountPageToken,
      pageSize: 20,
    });

    for (const account of accountsResponse.data.accounts ?? []) {
      if (!account.name) {
        continue;
      }

      let locationPageToken: string | undefined;

      do {
        const locationsResponse =
          await businessInformation.accounts.locations.list({
            parent: account.name,
            readMask: "name,title,storefrontAddress",
            pageToken: locationPageToken,
            pageSize: 100,
          });

        for (const location of locationsResponse.data.locations ?? []) {
          if (!location.name) {
            continue;
          }

          locations.push({
            googleLocationId: location.name,
            name: location.title ?? "Untitled location",
            address: formatAddress(location.storefrontAddress),
          });
        }

        locationPageToken = locationsResponse.data.nextPageToken ?? undefined;
      } while (locationPageToken);
    }

    accountPageToken = accountsResponse.data.nextPageToken ?? undefined;
  } while (accountPageToken);

  return locations;
}
