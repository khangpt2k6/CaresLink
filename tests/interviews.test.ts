import { describe, it, expect, beforeEach, vi } from "vitest";
import { createRequest, parseResponse } from "./helpers";
import { prismaMock, resetAuth, mockAuthAs, mockUnauthenticated } from "./setup";
import { GET, POST, DELETE } from "@/app/api/interviews/route";

// Mock the scheduling module
vi.mock("@/lib/scheduling", () => ({
  scheduleInterview: vi.fn(() =>
    Promise.resolve({
      id: "int_1",
      candidateId: "c1",
      position: "Nurse",
      scheduledAt: new Date("2026-04-01T10:00:00Z"),
      duration: 60,
      location: "Video Call",
      meetLink: null,
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

describe("GET /api/interviews", () => {
  it("returns upcoming interviews for employer", async () => {
    const interviews = [
      {
        id: "int_1",
        candidateId: "c1",
        position: "Nurse",
        scheduledAt: new Date("2026-04-01T10:00:00Z"),
        duration: 60,
        completed: false,
        noShow: false,
        cancelled: false,
        candidate: { id: "c1", name: "Alice", email: "alice@test.com" },
      },
    ];
    prismaMock.interview.findMany.mockResolvedValue(interviews);

    const req = createRequest("/api/interviews");
    const res = await GET(req) as Response;
    const { status, data } = await parseResponse<typeof interviews>(res);

    expect(status).toBe(200);
    expect(data).toHaveLength(1);
    expect(data[0].position).toBe("Nurse");
  });

  it("candidate only sees their own interviews", async () => {
    mockAuthAs("CANDIDATE", "alice@test.com");
    prismaMock.interview.findMany.mockResolvedValue([]);

    const req = createRequest("/api/interviews");
    await GET(req) as Response;

    // Verify the where clause includes email filter
    const call = prismaMock.interview.findMany.mock.calls[0][0];
    expect(call?.where?.candidate?.email).toBeDefined();
  });

  it("returns 401 when unauthenticated", async () => {
    mockUnauthenticated();

    const req = createRequest("/api/interviews");
    const res = await GET(req) as Response;
    expect(res.status).toBe(401);
  });
});

describe("POST /api/interviews", () => {
  it("schedules an interview", async () => {
    prismaMock.interview.findFirst.mockResolvedValue(null); // no existing

    const req = createRequest("/api/interviews", {
      method: "POST",
      body: { candidateId: "c1", scheduledAt: "2026-04-01T10:00:00Z" },
    });
    const res = await POST(req);
    const { status, data } = await parseResponse<{ id: string }>(res);

    expect(status).toBe(200);
    expect(data.id).toBe("int_1");
  });

  it("returns 409 when candidate already has upcoming interview", async () => {
    prismaMock.interview.findFirst.mockResolvedValue({
      id: "int_existing",
      scheduledAt: new Date("2026-04-02T10:00:00Z"),
    });

    const req = createRequest("/api/interviews", {
      method: "POST",
      body: { candidateId: "c1", scheduledAt: "2026-04-01T10:00:00Z" },
    });
    const res = await POST(req);
    const { status, data } = await parseResponse<{ error: string }>(res);

    expect(status).toBe(409);
    expect(data.error).toContain("already has an upcoming interview");
  });

  it("returns 400 when required fields are missing", async () => {
    const req = createRequest("/api/interviews", {
      method: "POST",
      body: { candidateId: "c1" }, // missing scheduledAt
    });
    const res = await POST(req);
    expect(res.status).toBe(400);
  });
});

describe("DELETE /api/interviews", () => {
  it("cancels an interview and cleans up", async () => {
    const interview = {
      id: "int_1",
      candidateId: "c1",
      calendarEventId: "cal_123",
      position: "Nurse",
      scheduledAt: new Date("2026-04-01T10:00:00Z"),
      candidate: { id: "c1", name: "Alice", email: "alice@test.com" },
    };
    prismaMock.interview.findUnique.mockResolvedValue(interview);
    prismaMock.event.deleteMany.mockResolvedValue({ count: 1 });
    prismaMock.interview.delete.mockResolvedValue(interview);
    prismaMock.interview.updateMany.mockResolvedValue({ count: 0 });
    prismaMock.interview.count.mockResolvedValue(0);
    prismaMock.candidate.update.mockResolvedValue({ id: "c1", status: "contacted" });

    const req = createRequest("/api/interviews?id=int_1", { method: "DELETE" });
    const res = await DELETE(req);
    const { status, data } = await parseResponse<{ success: boolean }>(res);

    expect(status).toBe(200);
    expect(data.success).toBe(true);
    // Should reset candidate status when no active interviews remain
    expect(prismaMock.candidate.update).toHaveBeenCalledWith(
      expect.objectContaining({ data: { status: "contacted" } })
    );
  });

  it("returns 404 when interview not found", async () => {
    prismaMock.interview.findUnique.mockResolvedValue(null);

    const req = createRequest("/api/interviews?id=nonexistent", { method: "DELETE" });
    const res = await DELETE(req);
    expect(res.status).toBe(404);
  });

  it("returns 400 when id is missing", async () => {
    const req = createRequest("/api/interviews", { method: "DELETE" });
    const res = await DELETE(req);
    expect(res.status).toBe(400);
  });
});
