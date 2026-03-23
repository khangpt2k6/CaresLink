import { NextRequest, NextResponse } from "next/server";
import { requireEmployer } from "@/lib/clerk-auth";
import { prisma } from "@/lib/db";

// GET /api/credential-check — list all checks for this employer
export async function GET(req: NextRequest) {
  const auth = await requireEmployer(req);
  if ("error" in auth) return auth.error;

  const checks = await prisma.credentialCheck.findMany({
    where: { employerId: auth.user.id },
    orderBy: { createdAt: "desc" },
    select: {
      id: true,
      firstName: true,
      middleName: true,
      lastName: true,
      email: true,
      roleType: true,
      targetState: true,
      status: true,
      aiRecommendation: true,
      recruiterDecision: true,
      createdAt: true,
      updatedAt: true,
    },
  });

  return NextResponse.json(checks);
}

// POST /api/credential-check — create a new credential check record
export async function POST(req: NextRequest) {
  const auth = await requireEmployer(req);
  if ("error" in auth) return auth.error;

  try {
    const body = await req.json();
    const {
      firstName,
      middleName,
      lastName,
      email,
      phone,
      address,
      licenseNumber,
      licenseState,
      roleType,
      targetState,
    } = body;

    if (!firstName || !lastName || !roleType) {
      return NextResponse.json(
        { error: "firstName, lastName, and roleType are required" },
        { status: 400 }
      );
    }
    if (!["NURSE", "CNA"].includes(roleType)) {
      return NextResponse.json({ error: "roleType must be NURSE or CNA" }, { status: 400 });
    }

    const check = await prisma.credentialCheck.create({
      data: {
        employerId: auth.user.id,
        firstName: firstName.trim(),
        middleName: middleName?.trim() || null,
        lastName: lastName.trim(),
        email: email?.trim() || null,
        phone: phone?.trim() || null,
        address: address?.trim() || null,
        licenseNumber: licenseNumber?.trim() || null,
        licenseState: licenseState?.trim() || null,
        roleType,
        targetState: targetState || "FLORIDA",
        status: "PENDING",
      },
    });

    return NextResponse.json(check, { status: 201 });
  } catch (e) {
    console.error(e);
    return NextResponse.json({ error: "Failed to create credential check" }, { status: 500 });
  }
}
