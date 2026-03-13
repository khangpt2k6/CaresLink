"use client";

import { useState } from "react";
import { motion } from "framer-motion";
import {
  ShieldCheck,
  Search,
  Loader2,
  CheckCircle2,
  XCircle,
  AlertTriangle,
  ExternalLink,
  User,
  FileText,
  MapPin,
  CalendarDays,
} from "lucide-react";

interface LicenseResult {
  name: string;
  licenseType: string;
  licenseNumber: string;
  status: string;
  expiration: string;
  city: string;
}

interface VerificationResponse {
  source: string;
  url: string;
  found: boolean;
  count?: number;
  results?: LicenseResult[];
  message?: string;
  error?: string;
}

function fadeUp(delay: number) {
  return {
    initial: { opacity: 0, y: 10 },
    animate: { opacity: 1, y: 0 },
    transition: {
      delay,
      duration: 0.35,
      ease: [0.16, 1, 0.3, 1] as [number, number, number, number],
    },
  };
}

export default function VerificationPage() {
  const [firstName, setFirstName] = useState("");
  const [lastName, setLastName] = useState("");
  const [licenseNumber, setLicenseNumber] = useState("");
  const [loading, setLoading] = useState(false);
  const [response, setResponse] = useState<VerificationResponse | null>(null);
  const [searched, setSearched] = useState(false);

  async function handleSearch(e: React.FormEvent) {
    e.preventDefault();
    if (!firstName && !lastName && !licenseNumber) return;

    setLoading(true);
    setResponse(null);
    setSearched(true);

    try {
      const res = await fetch("/api/verification", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          first_name: firstName || undefined,
          last_name: lastName || undefined,
          license_number: licenseNumber || undefined,
        }),
      });
      const data = await res.json();
      setResponse(data);
    } catch {
      setResponse({
        source: "FL DOH MQA",
        url: "",
        found: false,
        error: "Unable to reach the verification service. Please try again.",
      });
    } finally {
      setLoading(false);
    }
  }

  function getStatusBadge(status: string) {
    const s = status.toLowerCase();
    if (s.includes("active") && !s.includes("in")) {
      return (
        <span className="inline-flex items-center gap-1 rounded-full bg-emerald-50 px-2.5 py-1 text-xs font-semibold text-emerald-700">
          <CheckCircle2 className="h-3.5 w-3.5" /> Active
        </span>
      );
    }
    if (s.includes("inactive") || s.includes("expired") || s.includes("revoked")) {
      return (
        <span className="inline-flex items-center gap-1 rounded-full bg-red-50 px-2.5 py-1 text-xs font-semibold text-red-700">
          <XCircle className="h-3.5 w-3.5" /> {status}
        </span>
      );
    }
    return (
      <span className="inline-flex items-center gap-1 rounded-full bg-amber-50 px-2.5 py-1 text-xs font-semibold text-amber-700">
        <AlertTriangle className="h-3.5 w-3.5" /> {status}
      </span>
    );
  }

  return (
    <div className="p-6">
      {/* Header */}
      <motion.div {...fadeUp(0)} className="mb-5">
        <div className="flex items-center gap-2.5">
          <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-[#e8f4fd]">
            <ShieldCheck className="h-5 w-5 text-[#0090d9]" />
          </div>
          <div>
            <h1 className="text-xl font-bold text-[#1a2b3c]">
              License Verification
            </h1>
            <p className="text-sm text-[#5a6b7c]">
              Verify nursing licenses through the Florida Department of Health
            </p>
          </div>
        </div>
      </motion.div>

      {/* Search Form */}
      <motion.div {...fadeUp(0.06)}>
        <div className="card p-5">
          <h2 className="text-sm font-semibold text-[#1a2b3c]">
            Search Credentials
          </h2>
          <p className="mb-4 text-xs text-[#8a95a3]">
            Enter a candidate&apos;s name or license number to verify their
            nursing credentials against the FL DOH public database.
          </p>

          <form onSubmit={handleSearch} className="space-y-4">
            <div className="grid gap-3 sm:grid-cols-3">
              <div>
                <label className="mb-1 block text-xs font-medium text-[#5a6b7c]">
                  First Name
                </label>
                <input
                  type="text"
                  value={firstName}
                  onChange={(e) => setFirstName(e.target.value)}
                  placeholder="e.g. Jane"
                  className="w-full rounded-lg border border-[#e2e8f0] px-3 py-2 text-sm text-[#1a2b3c] placeholder:text-[#b0bec8] outline-none transition-colors focus:border-[#0090d9] focus:ring-1 focus:ring-[#0090d9]/20"
                />
              </div>
              <div>
                <label className="mb-1 block text-xs font-medium text-[#5a6b7c]">
                  Last Name
                </label>
                <input
                  type="text"
                  value={lastName}
                  onChange={(e) => setLastName(e.target.value)}
                  placeholder="e.g. Smith"
                  className="w-full rounded-lg border border-[#e2e8f0] px-3 py-2 text-sm text-[#1a2b3c] placeholder:text-[#b0bec8] outline-none transition-colors focus:border-[#0090d9] focus:ring-1 focus:ring-[#0090d9]/20"
                />
              </div>
              <div>
                <label className="mb-1 block text-xs font-medium text-[#5a6b7c]">
                  License Number
                </label>
                <input
                  type="text"
                  value={licenseNumber}
                  onChange={(e) => setLicenseNumber(e.target.value)}
                  placeholder="e.g. RN1234567"
                  className="w-full rounded-lg border border-[#e2e8f0] px-3 py-2 text-sm text-[#1a2b3c] placeholder:text-[#b0bec8] outline-none transition-colors focus:border-[#0090d9] focus:ring-1 focus:ring-[#0090d9]/20"
                />
              </div>
            </div>

            <div className="flex items-center gap-3">
              <button
                type="submit"
                disabled={loading || (!firstName && !lastName && !licenseNumber)}
                className="inline-flex items-center gap-2 rounded-lg bg-[#0090d9] px-4 py-2 text-sm font-medium text-white transition-all hover:bg-[#007ac1] disabled:opacity-50 disabled:cursor-not-allowed"
              >
                {loading ? (
                  <Loader2 className="h-4 w-4 animate-spin" />
                ) : (
                  <Search className="h-4 w-4" />
                )}
                {loading ? "Searching..." : "Verify License"}
              </button>
              {response?.url && (
                <a
                  href={response.url}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="inline-flex items-center gap-1 text-xs text-[#0090d9] hover:underline"
                >
                  Open FL DOH directly
                  <ExternalLink className="h-3 w-3" />
                </a>
              )}
            </div>
          </form>
        </div>
      </motion.div>

      {/* Results */}
      {searched && (
        <motion.div {...fadeUp(0.12)} className="mt-4">
          {loading ? (
            <div className="card flex flex-col items-center justify-center py-12">
              <Loader2 className="mb-3 h-8 w-8 animate-spin text-[#0090d9]" />
              <p className="text-sm text-[#5a6b7c]">
                Querying FL Department of Health...
              </p>
            </div>
          ) : response?.error ? (
            <div className="card border-red-100 bg-red-50/50 p-5">
              <div className="flex items-center gap-2.5">
                <XCircle className="h-5 w-5 text-red-500" />
                <div>
                  <p className="text-sm font-medium text-red-700">
                    Verification Error
                  </p>
                  <p className="text-xs text-red-600">{response.error}</p>
                </div>
              </div>
            </div>
          ) : response?.found && response.results ? (
            <div className="space-y-3">
              <div className="flex items-center justify-between">
                <p className="text-sm font-medium text-[#1a2b3c]">
                  {response.count} result{response.count !== 1 ? "s" : ""} found
                </p>
                <p className="text-[10px] text-[#8a95a3]">
                  Source: {response.source}
                </p>
              </div>
              {response.results.map((r, i) => (
                <motion.div
                  key={`${r.licenseNumber}-${i}`}
                  initial={{ opacity: 0, y: 8 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{
                    delay: i * 0.06,
                    duration: 0.28,
                    ease: [0.16, 1, 0.3, 1],
                  }}
                  className="card p-4"
                >
                  <div className="flex items-start justify-between gap-4">
                    <div className="flex-1 space-y-2.5">
                      <div className="flex items-center gap-3">
                        <div className="flex h-9 w-9 items-center justify-center rounded-full bg-[#0090d9] text-sm font-semibold text-white">
                          {r.name.charAt(0)}
                        </div>
                        <div>
                          <p className="text-sm font-semibold text-[#1a2b3c]">
                            {r.name}
                          </p>
                          <p className="text-xs text-[#8a95a3]">
                            {r.licenseType}
                          </p>
                        </div>
                      </div>

                      <div className="grid grid-cols-2 gap-x-6 gap-y-2 rounded-lg bg-[#f8fafc] px-3.5 py-2.5 sm:grid-cols-4">
                        <div className="flex items-center gap-1.5">
                          <FileText className="h-3.5 w-3.5 text-[#8a95a3]" />
                          <div>
                            <p className="text-[10px] text-[#8a95a3]">
                              License #
                            </p>
                            <p className="text-xs font-medium text-[#1a2b3c]">
                              {r.licenseNumber}
                            </p>
                          </div>
                        </div>
                        <div className="flex items-center gap-1.5">
                          <User className="h-3.5 w-3.5 text-[#8a95a3]" />
                          <div>
                            <p className="text-[10px] text-[#8a95a3]">Status</p>
                            <div>{getStatusBadge(r.status)}</div>
                          </div>
                        </div>
                        <div className="flex items-center gap-1.5">
                          <CalendarDays className="h-3.5 w-3.5 text-[#8a95a3]" />
                          <div>
                            <p className="text-[10px] text-[#8a95a3]">
                              Expiration
                            </p>
                            <p className="text-xs font-medium text-[#1a2b3c]">
                              {r.expiration || "N/A"}
                            </p>
                          </div>
                        </div>
                        <div className="flex items-center gap-1.5">
                          <MapPin className="h-3.5 w-3.5 text-[#8a95a3]" />
                          <div>
                            <p className="text-[10px] text-[#8a95a3]">City</p>
                            <p className="text-xs font-medium text-[#1a2b3c]">
                              {r.city || "N/A"}
                            </p>
                          </div>
                        </div>
                      </div>
                    </div>
                  </div>
                </motion.div>
              ))}
            </div>
          ) : (
            <div className="card flex flex-col items-center justify-center py-10 text-center">
              <AlertTriangle className="mb-2 h-7 w-7 text-[#d0dbe6]" />
              <p className="text-sm text-[#5a6b7c]">
                {response?.message || "No results found"}
              </p>
              <p className="mt-1 text-xs text-[#b0bec8]">
                Try a different spelling or search by license number
              </p>
            </div>
          )}
        </motion.div>
      )}

      {/* Info */}
      {!searched && (
        <motion.div {...fadeUp(0.12)} className="mt-4">
          <div className="card p-5">
            <h2 className="mb-2 text-sm font-semibold text-[#1a2b3c]">
              About License Verification
            </h2>
            <div className="space-y-2 text-xs text-[#5a6b7c] leading-relaxed">
              <p>
                This tool queries the <strong>Florida Department of Health</strong>{" "}
                MQA (Medical Quality Assurance) public database to verify nursing
                licenses and credentials.
              </p>
              <p>You can search by:</p>
              <ul className="ml-4 list-disc space-y-1">
                <li>
                  <strong>Name</strong> &mdash; Enter the candidate&apos;s first
                  and/or last name
                </li>
                <li>
                  <strong>License number</strong> &mdash; Enter the license number
                  directly for an exact match
                </li>
              </ul>
              <p>
                Results include license type, status (Active/Inactive),
                expiration date, and registered city. You can also verify licenses
                through the AI assistant by asking it directly.
              </p>
            </div>
          </div>
        </motion.div>
      )}
    </div>
  );
}
