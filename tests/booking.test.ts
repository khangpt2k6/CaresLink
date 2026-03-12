import { describe, it, expect, beforeEach, vi } from "vitest";
import { createRequest, parseResponse } from "./helpers";
import { prismaMock, resetAuth } from "./setup";
import { POST } from "@/app/api/booking/route";

vi.mock("@/lib/scheduling", () => ({
  scheduleInterview: vi.fn(() =>
    Promise.resolve({
      id: "int_booked",
      candidateId: "c1",
      position: "General",
      scheduledAt: new Date("2026-04-01T10:00:00Z"),
      duration: 60,
      location: "Video Call",
      meetLink: "https://meet.jit.si/careslink-int_booked",
      calendarLink: null,
      calendarEventId: null,
    })
  ),
}));

vi.mock("@/lib/timezone", () => ({
  getTimezone: vi.fn(() => Promise.resolve("America/New_York")),
  getTimezoneAbbr: vi.fn(() => "ET"),
  formatInTimezone: vi.fn(() => "Apr 1, 2026 10:00 AM"),
  getDefaultDuration: vi.fn(() => Promise.resolve(60)),
}));

beforeEach(() => {
  resetAuth();
  vi.clearAllMocks();
});

describe("POST /api/booking", () => {
  it("creates a new candidate and books interview", async () => {
    prismaMock.candidate.findFirst.mockResolvedValue(null); // new candidate
    prismaMock.candidate.create.mockResolvedValue({
      id: "c1",
      name: "Bob",
      email: "bob@test.com",
      phone: null,
      position: "General",
    });
    prismaMock.event.create.mockResolvedValue({});

    const req = createRequest("/api/booking", {
      method: "POST",
      body: {
        name: "Bob",
        email: "bob@test.com",
        scheduledAt: "2026-04-01T10:00:00Z",
      },
    });
    const res = await POST(req);
    const { status, data } = await parseResponse<{ success: boolean; interview: { id: string; meetLink: string }; candidate: { name: string } }>(res);

    expect(status).toBe(200);
    expect(data.success).toBe(true);
    expect(data.interview.id).toBe("int_booked");
    expect(data.candidate.name).toBe("Bob");
  });

  it("reuses existing candidate and auto-cancels old interviews", async () => {
    const existingCandidate = { id: "c1", name: "Bob", email: "bob@test.com", phone: "555-1234", position: "Nurse" };
    prismaMock.candidate.findFirst.mockResolvedValue(existingCandidate);
    prismaMock.candidate.update.mockResolvedValue(existingCandidate);
    prismaMock.interview.findMany.mockResolvedValue([
      { id: "old_int", calendarEventId: null, completed: false, noShow: false, cancelled: false, scheduledAt: new Date("2026-04-05T10:00:00Z") },
    ]);
    prismaMock.interview.update.mockResolvedValue({});
    prismaMock.event.create.mockResolvedValue({});

    const req = createRequest("/api/booking", {
      method: "POST",
      body: {
        name: "Bob",
        email: "bob@test.com",
        scheduledAt: "2026-04-01T10:00:00Z",
      },
    });
    const res = await POST(req);
    const { status } = await parseResponse(res);

    expect(status).toBe(200);
    // Old interview should be cancelled
    expect(prismaMock.interview.update).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { id: "old_int" },
        data: { cancelled: true },
      })
    );
  });

  it("returns 400 when name is missing", async () => {
    const req = createRequest("/api/booking", {
      method: "POST",
      body: { email: "bob@test.com", scheduledAt: "2026-04-01T10:00:00Z" },
    });
    const res = await POST(req);
    expect(res.status).toBe(400);
  });

  it("returns 400 when scheduledAt is in the past", async () => {
    const req = createRequest("/api/booking", {
      method: "POST",
      body: { name: "Bob", email: "bob@test.com", scheduledAt: "2020-01-01T10:00:00Z" },
    });
    const res = await POST(req);
    const { status, data } = await parseResponse<{ error: string }>(res);

    expect(status).toBe(400);
    expect(data.error).toContain("future");
  });
});
