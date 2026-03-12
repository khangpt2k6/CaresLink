import { describe, it, expect, beforeEach } from "vitest";
import { createRequest, parseResponse } from "./helpers";
import { prismaMock, resetAuth, mockUnauthenticated } from "./setup";
import { GET, POST, PUT, DELETE } from "@/app/api/jobs/route";

beforeEach(() => {
  resetAuth();
});

describe("GET /api/jobs", () => {
  it("returns jobs with candidate counts", async () => {
    const jobs = [
      { id: "j1", title: "Nurse", department: "Clinical", location: "Remote", type: "Full-time", status: "open", createdAt: new Date() },
    ];
    prismaMock.job.findMany.mockResolvedValue(jobs);
    prismaMock.candidate.groupBy.mockResolvedValue([
      { position: "Nurse", _count: { id: 5 } },
    ]);

    const req = createRequest("/api/jobs");
    const res = await GET(req);
    const { status, data } = await parseResponse<{ id: string; candidateCount: number }[]>(res);

    expect(status).toBe(200);
    expect(data[0].candidateCount).toBe(5);
  });

  it("returns 0 candidate count for unmatched positions", async () => {
    prismaMock.job.findMany.mockResolvedValue([
      { id: "j1", title: "Surgeon", department: null, location: "NYC", type: "Full-time", status: "open", createdAt: new Date() },
    ]);
    prismaMock.candidate.groupBy.mockResolvedValue([]);

    const req = createRequest("/api/jobs");
    const res = await GET(req);
    const { status, data } = await parseResponse<{ candidateCount: number }[]>(res);

    expect(status).toBe(200);
    expect(data[0].candidateCount).toBe(0);
  });

  it("filters by status query param", async () => {
    prismaMock.job.findMany.mockResolvedValue([]);
    prismaMock.candidate.groupBy.mockResolvedValue([]);

    const req = createRequest("/api/jobs?status=open");
    await GET(req);

    expect(prismaMock.job.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({ status: "open" }),
      })
    );
  });

  it("returns 401 when unauthenticated", async () => {
    mockUnauthenticated();

    const req = createRequest("/api/jobs");
    const res = await GET(req);
    expect(res.status).toBe(401);
  });
});

describe("POST /api/jobs", () => {
  it("creates a job with title only (defaults applied)", async () => {
    const job = { id: "j1", title: "CNA", department: null, location: "Remote", type: "Full-time", description: null };
    prismaMock.job.create.mockResolvedValue(job);

    const req = createRequest("/api/jobs", { method: "POST", body: { title: "CNA" } });
    const res = await POST(req);
    const { status, data } = await parseResponse<typeof job>(res);

    expect(status).toBe(200);
    expect(data.title).toBe("CNA");
  });

  it("returns 400 when title is missing", async () => {
    const req = createRequest("/api/jobs", { method: "POST", body: {} });
    const res = await POST(req);
    expect(res.status).toBe(400);
  });
});

describe("PUT /api/jobs", () => {
  it("updates a job", async () => {
    const updated = { id: "j1", title: "Senior Nurse", status: "closed" };
    prismaMock.job.update.mockResolvedValue(updated);

    const req = createRequest("/api/jobs", {
      method: "PUT",
      body: { id: "j1", title: "Senior Nurse", status: "closed" },
    });
    const res = await PUT(req);
    const { status, data } = await parseResponse<typeof updated>(res);

    expect(status).toBe(200);
    expect(data.title).toBe("Senior Nurse");
  });

  it("returns 400 when id is missing", async () => {
    const req = createRequest("/api/jobs", { method: "PUT", body: { title: "X" } });
    const res = await PUT(req);
    expect(res.status).toBe(400);
  });
});

describe("DELETE /api/jobs", () => {
  it("deletes a job", async () => {
    prismaMock.job.delete.mockResolvedValue({ id: "j1" });

    const req = createRequest("/api/jobs?id=j1", { method: "DELETE" });
    const res = await DELETE(req);
    const { status, data } = await parseResponse<{ success: boolean }>(res);

    expect(status).toBe(200);
    expect(data.success).toBe(true);
  });

  it("returns 400 when id is missing", async () => {
    const req = createRequest("/api/jobs", { method: "DELETE" });
    const res = await DELETE(req);
    expect(res.status).toBe(400);
  });
});
