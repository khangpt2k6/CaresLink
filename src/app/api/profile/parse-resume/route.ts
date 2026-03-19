import { NextRequest, NextResponse } from "next/server";
import { requireCandidate } from "@/lib/clerk-auth";
import Anthropic from "@anthropic-ai/sdk";

const anthropic = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY! });

export const runtime = "nodejs";
export const maxDuration = 30;

export async function POST(req: NextRequest) {
  const auth = await requireCandidate(req);
  if ("error" in auth) return auth.error;

  try {
    const formData = await req.formData();
    const file = formData.get("resume") as File | null;
    if (!file) return NextResponse.json({ error: "No file provided" }, { status: 400 });

    const ext = file.name.split(".").pop()?.toLowerCase();
    let text = "";

    if (ext === "pdf") {
      const buffer = Buffer.from(await file.arrayBuffer());
      // eslint-disable-next-line @typescript-eslint/no-require-imports
      const pdfParse = require("pdf-parse");
      const data = await pdfParse(buffer);
      text = data.text;
    } else if (ext === "docx" || ext === "doc") {
      const buffer = Buffer.from(await file.arrayBuffer());
      // eslint-disable-next-line @typescript-eslint/no-require-imports
      const mammoth = require("mammoth");
      const result = await mammoth.extractRawText({ buffer });
      text = result.value;
    } else if (ext === "txt") {
      text = await file.text();
    } else {
      return NextResponse.json({ error: "Unsupported file type. Please upload PDF, DOCX, or TXT." }, { status: 400 });
    }

    if (!text.trim()) {
      return NextResponse.json({ error: "Could not extract text from the file." }, { status: 400 });
    }

    // Use Claude to extract structured profile data
    const message = await anthropic.messages.create({
      model: "claude-haiku-4-5-20251001",
      max_tokens: 1500,
      messages: [
        {
          role: "user",
          content: `Extract structured profile information from this resume. Return ONLY valid JSON with no explanation or markdown.

Resume text:
${text.slice(0, 6000)}

Return this exact JSON structure (use null for missing fields, empty arrays for missing lists):
{
  "headline": "short professional headline (max 80 chars)",
  "summary": "professional summary paragraph or null",
  "phone": "phone number or null",
  "city": "city or null",
  "state": "state abbreviation or null",
  "experiences": [
    {
      "title": "job title",
      "company": "company name",
      "description": "brief description or null",
      "startDate": "YYYY-MM-DD",
      "endDate": "YYYY-MM-DD or null if current",
      "current": true or false
    }
  ],
  "educations": [
    {
      "school": "school name",
      "degree": "degree type or null",
      "field": "field of study or null",
      "startDate": "YYYY-MM-DD or null",
      "endDate": "YYYY-MM-DD or null"
    }
  ],
  "skills": ["skill1", "skill2"],
  "certifications": [
    {
      "name": "certification name",
      "issuer": "issuing org or null",
      "issueDate": "YYYY-MM-DD or null",
      "expiryDate": "YYYY-MM-DD or null"
    }
  ]
}`,
        },
      ],
    });

    const raw = message.content[0].type === "text" ? message.content[0].text : "";
    // Strip any accidental markdown fences
    const cleaned = raw.replace(/```json\n?/g, "").replace(/```\n?/g, "").trim();
    const parsed = JSON.parse(cleaned);

    return NextResponse.json({ profile: parsed });
  } catch (err) {
    console.error("Resume parse error:", err);
    return NextResponse.json({ error: "Failed to parse resume" }, { status: 500 });
  }
}
