import { NextRequest, NextResponse } from "next/server";
import { requireEmployer } from "@/lib/clerk-auth";
import Anthropic from "@anthropic-ai/sdk";

const anthropic = new Anthropic();

// POST /api/credential-check/parse-resume
// Accepts multipart/form-data with a "file" field (PDF or DOCX)
// Returns extracted candidate fields
export async function POST(req: NextRequest) {
  const auth = await requireEmployer(req);
  if ("error" in auth) return auth.error;

  try {
    const formData = await req.formData();
    const file = formData.get("file") as File | null;
    if (!file) {
      return NextResponse.json({ error: "No file provided" }, { status: 400 });
    }

    const mimeType = file.type;
    const buffer = Buffer.from(await file.arrayBuffer());

    let textContent = "";

    if (mimeType === "application/pdf" || file.name.endsWith(".pdf")) {
      // Use pdf-parse to extract text
      const { PDFParse } = await import("pdf-parse");
      const parser = new PDFParse({ data: buffer });
      const data = await parser.getText();
      textContent = data.text;
    } else if (
      mimeType === "application/vnd.openxmlformats-officedocument.wordprocessingml.document" ||
      file.name.endsWith(".docx")
    ) {
      // Use mammoth for DOCX
      const mammoth = await import("mammoth");
      const result = await mammoth.extractRawText({ buffer });
      textContent = result.value;
    } else {
      return NextResponse.json({ error: "Unsupported file type. Use PDF or DOCX." }, { status: 400 });
    }

    if (!textContent.trim()) {
      return NextResponse.json({ error: "Could not extract text from file" }, { status: 422 });
    }

    // Use AI to extract structured data
    const msg = await anthropic.messages.create({
      model: "claude-sonnet-4-6",
      max_tokens: 600,
      messages: [
        {
          role: "user",
          content: `Extract the following fields from this healthcare resume/document. Return ONLY valid JSON with these exact keys (use null for missing fields):
{
  "firstName": string | null,
  "middleName": string | null,
  "lastName": string | null,
  "email": string | null,
  "phone": string | null,
  "address": string | null,
  "licenseNumber": string | null,
  "licenseState": string | null,
  "roleType": "NURSE" | "CNA" | null
}

For licenseState, use 2-letter state abbreviation (e.g. "FL", "TX").
For roleType: use "NURSE" if the person is an RN/LPN/LVN, "CNA" if they are a CNA/Nurse Aide.

Resume text:
${textContent.slice(0, 4000)}`,
        },
      ],
    });

    const raw = (msg.content[0] as { type: string; text: string }).text;
    const jsonMatch = raw.match(/\{[\s\S]*\}/);
    if (!jsonMatch) {
      return NextResponse.json({ error: "AI could not parse resume" }, { status: 422 });
    }

    const parsed = JSON.parse(jsonMatch[0]);
    return NextResponse.json(parsed);
  } catch (e) {
    console.error("Resume parse error:", e);
    return NextResponse.json({ error: "Failed to parse resume" }, { status: 500 });
  }
}
