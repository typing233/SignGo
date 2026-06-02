import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

type RouteParams = { params: Promise<{ token: string }> };

export async function GET(_request: Request, { params }: RouteParams) {
  const { token } = await params;

  const process = await prisma.signingProcess.findUnique({
    where: { token },
    include: {
      document: true,
      signFields: true,
    },
  });

  if (!process) {
    return NextResponse.json({ error: "签署链接无效" }, { status: 404 });
  }

  if (process.status === "signed") {
    return NextResponse.json({ error: "该文档已签署", signed: true }, { status: 400 });
  }

  return NextResponse.json({
    process: {
      id: process.id,
      signerName: process.signerName,
      signerEmail: process.signerEmail,
      status: process.status,
      order: process.order,
    },
    document: {
      id: process.document.id,
      name: process.document.name,
    },
    fields: process.signFields,
  });
}

export async function POST(request: Request, { params }: RouteParams) {
  const { token } = await params;

  const process = await prisma.signingProcess.findUnique({
    where: { token },
    include: { document: true, signFields: true },
  });

  if (!process) {
    return NextResponse.json({ error: "签署链接无效" }, { status: 404 });
  }

  if (process.status === "signed") {
    return NextResponse.json({ error: "该文档已签署" }, { status: 400 });
  }

  // Check if previous signers have completed (sequential signing)
  const pendingBefore = await prisma.signingProcess.findFirst({
    where: {
      documentId: process.documentId,
      order: { lt: process.order },
      status: { not: "signed" },
    },
  });

  if (pendingBefore) {
    return NextResponse.json(
      { error: "需要等待前序签署方完成签署" },
      { status: 400 }
    );
  }

  const body = await request.json();
  const { fieldValues, signatureData } = body as {
    fieldValues: { fieldId: string; value: string }[];
    signatureData?: string;
  };

  // Update field values
  if (fieldValues?.length) {
    for (const fv of fieldValues) {
      await prisma.signField.update({
        where: { id: fv.fieldId, signingProcessId: process.id },
        data: { value: fv.value },
      });
    }
  }

  // Mark as signed
  await prisma.signingProcess.update({
    where: { id: process.id },
    data: {
      status: "signed",
      signedAt: new Date(),
      signatureData: signatureData || null,
    },
  });

  // Check if all processes for this document are signed
  const remaining = await prisma.signingProcess.count({
    where: { documentId: process.documentId, status: { not: "signed" } },
  });

  if (remaining === 0) {
    await prisma.document.update({
      where: { id: process.documentId },
      data: { status: "signed" },
    });
  }

  return NextResponse.json({ success: true });
}
