import { NextRequest, NextResponse } from "next/server";
import { requireUser } from "@/lib/clerk-auth";
import { textCompletion } from "@/lib/ai-provider";

// POST /api/credential-check/parse-resume
// Multipart upload (`file`) of a PDF / DOCX / TXT resume.
// Extracts text, asks Claude for structured candidate fields, and returns:
// { firstName, middleName, lastName, email, phone, licenseNumber, roleType }
// Any field may come back as an empty string when not found.
export async function POST(req: NextRequest) {
  const auth = await requireUser(req);
  if (auth.error) return auth.error;

  let form: FormData;
  try {
    form = await req.formData();
  } catch {
    return NextResponse.json(
      { error: "Expected multipart/form-data with a 'file' field." },
      { status: 400 },
    );
  }

  const file = form.get("file");
  if (!(file instanceof File)) {
    return NextResponse.json(
      { error: "Missing 'file' upload." },
      { status: 400 },
    );
  }
  if (file.size === 0) {
    return NextResponse.json({ error: "File is empty." }, { status: 400 });
  }
  if (file.size > 10 * 1024 * 1024) {
    return NextResponse.json(
      { error: "File too large (max 10MB)." },
      { status: 413 },
    );
  }

  const bytes = Buffer.from(await file.arrayBuffer());
  let text: string;
  try {
    text = await extractText(file.name, file.type, bytes);
  } catch (e) {
    return NextResponse.json(
      { error: `Could not read file: ${(e as Error).message}` },
      { status: 400 },
    );
  }

  const trimmed = text.trim();
  if (trimmed.length < 30) {
    return NextResponse.json(
      { error: "Resume text was too short to parse." },
      { status: 422 },
    );
  }

  // Truncate to keep prompt small and cheap. ~12k chars covers most resumes.
  const snippet = trimmed.slice(0, 12_000);

  const system = [
    "You extract structured candidate info from healthcare resumes.",
    "Reply with ONLY a JSON object, no prose, no code fences.",
    "Schema:",
    "{",
    '  "firstName": string,',
    '  "middleName": string,',
    '  "lastName": string,',
    '  "email": string,',
    '  "phone": string,',
    '  "licenseNumber": string,',
    '  "roleType": "RN" | "LPN" | "CNA"',
    "}",
    'Use empty string "" for missing fields. roleType: pick the candidate\'s primary nursing license — RN for registered nurse, LPN for licensed practical nurse, CNA for nursing assistant. If unclear, use "RN".',
  ].join("\n");

  let raw: string;
  try {
    raw = await textCompletion({
      system,
      messages: [
        {
          role: "user",
          content: `Resume text:\n\n${snippet}\n\nReturn the JSON now.`,
        },
      ],
      maxTokens: 600,
    });
  } catch (e) {
    return NextResponse.json(
      { error: `AI extraction failed: ${(e as Error).message}` },
      { status: 502 },
    );
  }

  const parsed = safeParseJson(raw);
  if (!parsed) {
    return NextResponse.json(
      { error: "AI returned invalid JSON.", raw },
      { status: 502 },
    );
  }

  const result = normalize(parsed);
  return NextResponse.json(result);
}

async function extractText(
  fileName: string,
  mimeType: string,
  bytes: Buffer,
): Promise<string> {
  const lower = fileName.toLowerCase();
  const isPdf =
    mimeType === "application/pdf" || lower.endsWith(".pdf");
  const isDocx =
    mimeType ===
      "application/vnd.openxmlformats-officedocument.wordprocessingml.document" ||
    lower.endsWith(".docx");
  const isTxt = mimeType.startsWith("text/") || lower.endsWith(".txt");

  if (isPdf) {
    const { PDFParse } = await import("pdf-parse");
    const parser = new PDFParse({ data: new Uint8Array(bytes) });
    try {
      const out = await parser.getText();
      return out.text ?? "";
    } finally {
      await parser.destroy();
    }
  }
  if (isDocx) {
    const mammoth = await import("mammoth");
    const out = await mammoth.extractRawText({ buffer: bytes });
    return out.value ?? "";
  }
  if (isTxt) {
    return bytes.toString("utf8");
  }
  throw new Error(
    `Unsupported file type. Expected PDF, DOCX, or TXT (got ${mimeType || "unknown"}).`,
  );
}

function safeParseJson(raw: string): unknown {
  const trimmed = raw.trim();
  // Strip markdown fences if the model added them despite instructions.
  const stripped = trimmed
    .replace(/^```(?:json)?\s*/i, "")
    .replace(/\s*```$/i, "")
    .trim();
  try {
    return JSON.parse(stripped);
  } catch {
    // Last-ditch: find the first { ... } block.
    const start = stripped.indexOf("{");
    const end = stripped.lastIndexOf("}");
    if (start >= 0 && end > start) {
      try {
        return JSON.parse(stripped.slice(start, end + 1));
      } catch {
        return null;
      }
    }
    return null;
  }
}

function normalize(raw: unknown): {
  firstName: string;
  middleName: string;
  lastName: string;
  email: string;
  phone: string;
  licenseNumber: string;
  roleType: "RN" | "LPN" | "CNA";
} {
  const obj = (raw && typeof raw === "object" ? raw : {}) as Record<
    string,
    unknown
  >;
  const s = (k: string) =>
    typeof obj[k] === "string" ? (obj[k] as string).trim() : "";

  const roleRaw = s("roleType").toUpperCase();
  let roleType: "RN" | "LPN" | "CNA" = "RN";
  if (roleRaw === "LPN") roleType = "LPN";
  else if (
    roleRaw === "CNA" ||
    roleRaw.includes("NURSING ASSISTANT")
  )
    roleType = "CNA";
  else if (roleRaw === "RN" || roleRaw.includes("REGISTERED")) roleType = "RN";

  return {
    firstName: s("firstName"),
    middleName: s("middleName"),
    lastName: s("lastName"),
    email: s("email"),
    phone: s("phone"),
    licenseNumber: s("licenseNumber"),
    roleType,
  };
}
