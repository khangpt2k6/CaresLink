/**
 * SAM.gov License Verification — Placeholder
 * Steps will be confirmed by the user. Until then, this returns a manual_required
 * result with instructions and a link to SAM.gov.
 *
 * When SAM.gov steps are confirmed, implement:
 * 1. Navigate to SAM.gov
 * 2. Go to "License Verification" section
 * 3. Enter full legal name, license number, date of birth
 * 4. Select appropriate state
 * 5. Review license status, renewal date, disciplinary records
 */

export type SAMGovStatus = "clear" | "excluded" | "manual_required" | "error";

export interface SAMGovResult {
  status: SAMGovStatus;
  searchedName: string;
  message: string;
  details?: string;
  manualUrl: string;
  checkedAt: string;
}

const MANUAL_URL = "https://sam.gov";

export async function checkSAMGov(
  firstName: string,
  lastName: string,
  licenseNumber?: string,
  _licenseState?: string
): Promise<SAMGovResult> {
  const searchedName = `${firstName} ${lastName}`.toUpperCase();
  const checkedAt = new Date().toISOString();

  // TODO: Implement when SAM.gov verification steps are confirmed.
  // The SAM.gov API (api.sam.gov) requires a free API key and can check
  // entity exclusions via: GET /entity-information/v3/entities?ueiSAM=...
  // For individual license verification, the steps will be confirmed by the user.

  return {
    status: "manual_required",
    searchedName,
    message:
      "SAM.gov verification requires manual completion. Follow the steps below, " +
      "capture a screenshot of the result, and attach it to this report.",
    details: [
      "1. Visit sam.gov",
      "2. Navigate to the 'License Verification' section",
      `3. Enter: Full legal name: ${searchedName}${licenseNumber ? `, License #: ${licenseNumber}` : ""}`,
      "4. Enter date of birth when prompted",
      "5. Select the appropriate state from results",
      "6. Review license status, renewal date, and any disciplinary records",
      "7. Screenshot the result page for your records",
    ].join("\n"),
    manualUrl: MANUAL_URL,
    checkedAt,
  };
}
