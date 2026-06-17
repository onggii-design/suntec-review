export type BrandName = "Onggii" | "Sotpot";

export type GoogleLocationSummary = {
  googleLocationId: string;
  name: string;
  address: string | null;
};

export type LocationAssignment = GoogleLocationSummary & {
  brand: BrandName;
};

export type SaveLocationsRequest = {
  locations: LocationAssignment[];
};
