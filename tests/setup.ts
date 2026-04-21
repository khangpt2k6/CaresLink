import { vi } from "vitest";

// ── Mock Prisma ──────────────────────────────────────────────────────
// Every test gets a fresh mock. Individual tests override return values.
const mockPrismaClient = {
  user: { findUnique: vi.fn(), findFirst: vi.fn(), create: vi.fn(), update: vi.fn(), findUniqueOrThrow: vi.fn() },
  candidate: { findMany: vi.fn(), findFirst: vi.fn(), findUnique: vi.fn(), create: vi.fn(), update: vi.fn(), delete: vi.fn(), groupBy: vi.fn() },
  job: { findMany: vi.fn(), create: vi.fn(), update: vi.fn(), delete: vi.fn() },
  interview: { findMany: vi.fn(), findFirst: vi.fn(), findUnique: vi.fn(), create: vi.fn(), update: vi.fn(), updateMany: vi.fn(), delete: vi.fn(), deleteMany: vi.fn(), count: vi.fn() },
  event: { create: vi.fn(), deleteMany: vi.fn() },
  availability: { findUnique: vi.fn(), findMany: vi.fn() },
  dateOverride: { findUnique: vi.fn(), findMany: vi.fn() },
  settings: { findFirst: vi.fn() },
  candidateAvailability: { findMany: vi.fn() },
  candidateProfile: { findUnique: vi.fn(), upsert: vi.fn() },
};

vi.mock("@/lib/db", () => ({ prisma: mockPrismaClient }));

// ── Mock Supabase auth ───────────────────────────────────────────────
// Default: authenticated employer. Tests can override via mockAuthAs().
let mockRole = "EMPLOYER";
let mockUserId: string | null = "user_test123";
let mockEmail = "recruiter@careslink.com";

// Mock getOrCreateUser / requireUser to return a user with the current role
vi.mock("@/lib/clerk-auth", async (importOriginal) => {
  const actual = (await importOriginal()) as Record<string, unknown>;
  return {
    ...actual,
    requireUser: vi.fn(async () => {
      if (!mockUserId) {
        const { NextResponse } = await import("next/server");
        return { error: NextResponse.json({ error: "Unauthorized" }, { status: 401 }) };
      }
      return {
        user: {
          id: "db_user_1",
          clerkId: mockUserId,
          email: mockEmail,
          name: "Test User",
          role: mockRole,
          image: null,
        },
      };
    }),
    requireEmployer: vi.fn(async () => {
      if (!mockUserId) {
        const { NextResponse } = await import("next/server");
        return { error: NextResponse.json({ error: "Unauthorized" }, { status: 401 }) };
      }
      if (mockRole !== "EMPLOYER") {
        const { NextResponse } = await import("next/server");
        return { error: NextResponse.json({ error: "Only recruiters can perform this action." }, { status: 403 }) };
      }
      return {
        user: {
          id: "db_user_1",
          clerkId: mockUserId,
          email: mockEmail,
          name: "Test User",
          role: mockRole,
          image: null,
        },
      };
    }),
  };
});

// ── Mock external services ───────────────────────────────────────────
vi.mock("@/lib/sendgrid", () => ({ sendEmail: vi.fn(() => Promise.resolve()) }));
vi.mock("@/lib/google-calendar", () => ({
  createCalendarEvent: vi.fn(() => Promise.resolve(null)),
  deleteCalendarEvent: vi.fn(() => Promise.resolve()),
  getFreeBusySlots: vi.fn(() => Promise.resolve([])),
  isCalendarConfigured: vi.fn(() => Promise.resolve(false)),
}));
vi.mock("@/lib/microsoft-calendar", () => ({
  createCalendarEvent: vi.fn(() => Promise.resolve(null)),
  deleteCalendarEvent: vi.fn(() => Promise.resolve()),
  getFreeBusySlots: vi.fn(() => Promise.resolve([])),
  isCalendarConfigured: vi.fn(() => Promise.resolve(false)),
}));

// ── Helpers for tests ────────────────────────────────────────────────
export function mockAuthAs(role: "EMPLOYER" | "CANDIDATE", email?: string) {
  mockRole = role;
  if (email) mockEmail = email;
}

export function mockUnauthenticated() {
  mockUserId = null;
}

export function resetAuth() {
  mockRole = "EMPLOYER";
  mockUserId = "user_test123";
  mockEmail = "recruiter@careslink.com";
}

export { mockPrismaClient as prismaMock };
