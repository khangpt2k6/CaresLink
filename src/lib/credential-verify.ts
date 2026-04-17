import { Prisma } from "@prisma/client";
import { prisma } from "@/lib/db";
import { checkOIGExclusion } from "@/lib/oig-exclusion";
import { checkSAMGov } from "@/lib/sam-gov";
import { captureCnaStateRegistryScreenshots, captureNursysScreenshots } from "@/lib/browser-verify";
import { CNA_REGISTRY, resolveCnaRegistryState } from "@/lib/cna-registry-state";

export async function runCredentialVerification(checkId: string, employerId: string) {
  const check = await prisma.credentialCheck.findFirst({
    where: { id: checkId, employerId },
  });

  if (!check) {
    throw new Error("Credential check not found.");
  }

  await prisma.credentialCheck.update({
    where: { id: checkId },
    data: { status: "IN_PROGRESS", errorMessage: null },
  });

  const { firstName, middleName, lastName, licenseNumber, licenseState, roleType, targetState } = check;

  let nursysData = null;
  let floridaDohData = null;
  let oigResult = null;
  let samGovResult = null;
  let aiRecommendation: string | null = null;
  let aiSummary: string | null = null;

  const CACHE_TTL_MS = 24 * 60 * 60 * 1000;
  const cached = await prisma.credentialCheck.findFirst({
    where: {
      id: { not: checkId },
      firstName: { equals: firstName, mode: "insensitive" },
      lastName: { equals: lastName, mode: "insensitive" },
      roleType,
      status: "COMPLETED",
      recruiterDecision: "APPROVED",
      updatedAt: { gte: new Date(Date.now() - CACHE_TTL_MS) },
    },
    orderBy: { updatedAt: "desc" },
  });

  if (cached) {
    nursysData = cached.nursysData;
    floridaDohData = cached.floridaDohData;
    oigResult = cached.oigData;
    samGovResult = cached.samGovData;
    aiRecommendation = cached.aiRecommendation ?? "EMPLOYABLE";
    aiSummary = cached.aiSummary ?? "Reused from previously approved credential verification.";
  } else if (roleType === "NURSE") {
    const [oig, sam] = await Promise.all([
      checkOIGExclusion(firstName, lastName, middleName ?? undefined),
      checkSAMGov(firstName, lastName, licenseNumber ?? undefined, licenseState ?? undefined),
    ]);
    oigResult = oig;
    samGovResult = sam;

    try {
      const nursysBrowser = await captureNursysScreenshots(
        firstName,
        lastName,
        licenseState ?? null,
        licenseNumber ?? null
      );
      const hasReport = nursysBrowser.report && nursysBrowser.report.licenses.length > 0;
      nursysData = {
        status: hasReport || nursysBrowser.screenshots.length > 4 ? "found" : "manual_required",
        searchedName: `${firstName} ${lastName}`.toUpperCase(),
        screenshots: nursysBrowser.screenshots.map((s) => ({ label: s.label, dataUrl: s.dataUrl })),
        reportPdfPath: nursysBrowser.reportPdfPath || null,
        reportPdfBase64: nursysBrowser.reportPdfBase64 || null,
        browserVerified: true,
        report: nursysBrowser.report
          ? {
              ncsbnId: nursysBrowser.report.ncsbnId,
              fullName: nursysBrowser.report.fullName,
              reportDate: nursysBrowser.report.reportDate,
              licenses: nursysBrowser.report.licenses,
              boardMessages: nursysBrowser.report.boardMessages,
              authorizedStates: nursysBrowser.report.authorizedStates,
            }
          : undefined,
      };
    } catch (nursysErr) {
      console.error("[verify] Nursys browser capture failed:", nursysErr);
      nursysData = {
        status: "manual_required",
        searchedName: `${firstName} ${lastName}`.toUpperCase(),
        screenshots: [],
        browserVerified: false,
        error: nursysErr instanceof Error ? nursysErr.message : String(nursysErr),
      };
    }

    aiRecommendation = "REVIEW_REQUIRED";
    aiSummary = "Verification completed. Please review and mark success to enable cache reuse.";
  } else {
    const cnaRegistry = resolveCnaRegistryState(licenseState, targetState);
    const registryMeta = CNA_REGISTRY[cnaRegistry];
    try {
      const dohResult = await captureCnaStateRegistryScreenshots(
        firstName,
        lastName,
        licenseNumber ?? undefined,
        licenseState,
        targetState
      );
      floridaDohData = {
        registryCode: cnaRegistry,
        registryTitle: registryMeta.title,
        status: dohResult.found ? "found" : "not_found",
        searchedName: `${firstName} ${lastName}`.toUpperCase(),
        licenseType: "Certified Nursing Assistant",
        matches: dohResult.matches.map((m) => ({
          name: m.name,
          licenseNumber: m.licenseNumber,
          licenseType: m.licenseType || "Certified Nursing Assistant",
          status: m.status,
          expirationDate: m.expirationDate,
          county: m.county || undefined,
        })),
        manualUrl: registryMeta.manualUrl,
        checkedAt: new Date().toISOString(),
        screenshots: dohResult.screenshots.map((s) => ({ label: s.label, dataUrl: s.dataUrl })),
      };
    } catch (dohErr) {
      console.error("[verify] State CNA registry browser capture failed:", dohErr);
      floridaDohData = {
        registryCode: cnaRegistry,
        registryTitle: registryMeta.title,
        status: "manual_required",
        searchedName: `${firstName} ${lastName}`.toUpperCase(),
        licenseType: "Certified Nursing Assistant",
        matches: [],
        manualUrl: registryMeta.manualUrl,
        checkedAt: new Date().toISOString(),
        screenshots: [],
        error: dohErr instanceof Error ? dohErr.message : String(dohErr),
      };
    }

    aiRecommendation = "REVIEW_REQUIRED";
    aiSummary = "Verification completed. Please review and mark success to enable cache reuse.";
  }

  return prisma.credentialCheck.update({
    where: { id: checkId },
    data: {
      status: "COMPLETED",
      nursysData: nursysData
        ? (nursysData as unknown as Prisma.InputJsonValue)
        : roleType === "CNA"
          ? Prisma.JsonNull
          : undefined,
      floridaDohData: floridaDohData ? (floridaDohData as unknown as Prisma.InputJsonValue) : undefined,
      oigData: oigResult
        ? (oigResult as unknown as Prisma.InputJsonValue)
        : roleType === "CNA"
          ? Prisma.JsonNull
          : undefined,
      samGovData: samGovResult
        ? (samGovResult as unknown as Prisma.InputJsonValue)
        : roleType === "CNA"
          ? Prisma.JsonNull
          : undefined,
      aiRecommendation,
      aiSummary,
    },
  });
}
