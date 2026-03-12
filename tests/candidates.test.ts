import { describe, it, expect, beforeEach } from "vitest";
import { createRequest, parseResponse } from "./helpers";
import { prismaMock, resetAuth, mockAuthAs, mockUnauthenticated } from "./setup";
import { GET, POST, PUT, DELETE } from "@/app/api/candidates/route";

beforeEach(() => {
  resetAuth();
});

describe("GET /api/candidates", () => {
  it("returns candidates sorted with pinned emails first", async () => {
    const candidates = [
      { id: "1", name: "Alice", email: "alice@test.com", position: "Nurse", appliedAt: new Date(), interviews: [] },
      { id: "2", name: "Khang", email: "2006tuankhang@gmail.com", position: "CNA", appliedAt: new Date(), interviews: [] },
    ];
    prismaMock.candidate.findMany.mockResolvedValue(candidates);

    const req = createRequest("/api/candidates");
    const res = await GET(req);
    const { status, data } = await parseResponse<{ id: string; name: string }[]>(res);

    expect(status).toBe(200);
    // Pinned email should come first
    expect(data[0].name).toBe("Khang");
    expect(data[1].name).toBe("Alice");
  });

  it("filters candidates by position", async () => {
    prismaMock.candidate.findMany.mockResolvedValue([]);

    const req = createRequest("/api/candidates?position=Nurse");
    await GET(req);

    expect(prismaMock.candidate.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({ position: "Nurse" }),
      })
    );
  });

  it("returns 401 when unauthenticated", async () => {
    mockUnauthenticated();

    const req = createRequest("/api/candidates");
    const res = await GET(req);
    const { status } = await parseResponse(res);

    expect(status).toBe(401);
  });

  it("returns 403 when candidate role tries to access", async () => {
    mockAuthAs("CANDIDATE");

    const req = createRequest("/api/candidates");
    const res = await GET(req);
    const { status } = await parseResponse(res);

    expect(status).toBe(403);
  });
});

describe("POST /api/candidates", () => {
  it("creates a candidate with valid data", async () => {
    const newCandidate = { id: "c1", name: "Jane", email: "jane@test.com", phone: null, position: "RN" };
    prismaMock.candidate.create.mockResolvedValue(newCandidate);

    const req = createRequest("/api/candidates", {
      method: "POST",
      body: { name: "Jane", email: "jane@test.com", position: "RN" },
    });
    const res = await POST(req);
    const { status, data } = await parseResponse<typeof newCandidate>(res);

    expect(status).toBe(200);
    expect(data.name).toBe("Jane");
    expect(data.position).toBe("RN");
  });

  it("returns 400 when required fields are missing", async () => {
    const req = createRequest("/api/candidates", {
      method: "POST",
      body: { name: "Jane" }, // missing email and position
    });
    const res = await POST(req);
    const { status, data } = await parseResponse<{ error: string }>(res);

    expect(status).toBe(400);
    expect(data.error).toContain("required");
  });
});

describe("PUT /api/candidates", () => {
  it("updates candidate fields", async () => {
    const updated = { id: "c1", name: "Jane Updated", email: "jane@test.com", position: "RN", status: "contacted" };
    prismaMock.candidate.update.mockResolvedValue(updated);

    const req = createRequest("/api/candidates", {
      method: "PUT",
      body: { id: "c1", name: "Jane Updated", status: "contacted" },
    });
    const res = await PUT(req);
    const { status, data } = await parseResponse<typeof updated>(res);

    expect(status).toBe(200);
    expect(data.name).toBe("Jane Updated");
  });

  it("returns 400 when id is missing", async () => {
    const req = createRequest("/api/candidates", {
      method: "PUT",
      body: { name: "Jane" },
    });
    const res = await PUT(req);
    const { status } = await parseResponse(res);

    expect(status).toBe(400);
  });
});

describe("DELETE /api/candidates", () => {
  it("deletes candidate and related data", async () => {
    prismaMock.event.deleteMany.mockResolvedValue({ count: 2 });
    prismaMock.interview.deleteMany.mockResolvedValue({ count: 1 });
    prismaMock.candidate.delete.mockResolvedValue({ id: "c1" });

    const req = createRequest("/api/candidates?id=c1", { method: "DELETE" });
    const res = await DELETE(req);
    const { status, data } = await parseResponse<{ success: boolean }>(res);

    expect(status).toBe(200);
    expect(data.success).toBe(true);

    // Verify cascade delete order
    expect(prismaMock.event.deleteMany).toHaveBeenCalledWith({ where: { candidateId: "c1" } });
    expect(prismaMock.interview.deleteMany).toHaveBeenCalledWith({ where: { candidateId: "c1" } });
    expect(prismaMock.candidate.delete).toHaveBeenCalledWith({ where: { id: "c1" } });
  });

  it("returns 400 when id is missing", async () => {
    const req = createRequest("/api/candidates", { method: "DELETE" });
    const res = await DELETE(req);
    const { status } = await parseResponse(res);

    expect(status).toBe(400);
  });
});
