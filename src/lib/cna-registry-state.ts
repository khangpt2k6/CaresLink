/** Which state CNA / nurse aide registry to query for automated verification. */

export type CnaRegistryCode = "FL" | "TX" | "GA";

export const CNA_REGISTRY = {
  FL: {
    code: "FL" as const,
    title: "Florida DOH — MQA Health Care Provider Search",
    manualUrl: "https://mqa-internet.doh.state.fl.us/MQASearchServices/HealthCareProviders",
  },
  TX: {
    code: "TX" as const,
    title: "Texas Nurse Aide Registry (TULIP)",
    manualUrl: "https://tulip.hhs.texas.gov/TULIP/s/public-search",
  },
  GA: {
    code: "GA" as const,
    title: "Georgia Nurse Aide Registry (MMIS)",
    manualUrl: "https://www.mmis.georgia.gov/portal/Default.aspx?tabid=44",
  },
} satisfies Record<CnaRegistryCode, { code: CnaRegistryCode; title: string; manualUrl: string }>;

function norm(s: string) {
  return s.trim().toUpperCase();
}

/**
 * Prefer the 2-letter license issuing state when it is FL, TX, or GA; otherwise map
 * full target state names (as stored on CredentialCheck.targetState).
 */
export function resolveCnaRegistryState(
  licenseState?: string | null,
  targetState?: string | null
): CnaRegistryCode {
  const lic = licenseState ? norm(licenseState) : "";
  if (lic === "TX" || lic === "GA" || lic === "FL") return lic;

  const tgt = targetState ? norm(targetState) : "";
  if (tgt === "TEXAS" || tgt === "TX") return "TX";
  if (tgt === "GEORGIA" || tgt === "GA") return "GA";
  if (tgt === "FLORIDA" || tgt === "FL") return "FL";

  return "FL";
}
