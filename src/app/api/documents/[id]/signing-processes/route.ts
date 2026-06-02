import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { sendSigningInvitation } from "@/lib/email";

type RouteParams = { params: Promise<{ id: string }> };

export async function GET(_request: Request, { params }: RouteParams) {
  const session = await getServerSession(authOptions);
  if (!session?.user?.id) {
    return NextResponse.json({ error: "未授权" }, { status: 401 });
  }

  const { id } = await params;

  const document = await prisma.document.findUnique({
    where: { id, ownerId: session.user.id },
  });
  if (!document) {
    return NextResponse.json({ error: "文档不存在" }, { status: 404 });
  }

  const processes = await prisma.signingProcess.findMany({
    where: { documentId: id },
    include: { signFields: true },
    orderBy: { order: "asc" },
  });

  return NextResponse.json(processes);
}

export async function POST(request: Request, { params }: RouteParams) {
  const session = await getServerSession(authOptions);
  if (!session?.user?.id) {
    return NextResponse.json({ error: "未授权" }, { status: 401 });
  }

  const { id } = await params;

  const document = await prisma.document.findUnique({
    where: { id, ownerId: session.user.id },
  });
  if (!document) {
    return NextResponse.json({ error: "文档不存在" }, { status: 404 });
  }

  const body = await request.json();
  const { signers, fields } = body as {
    signers: { name: string; email: string; order: number }[];
    fields: {
      type: string;
      page: number;
      x: number;
      y: number;
      width: number;
      height: number;
      label?: string;
      signerIndex: number;
    }[];
  };

  if (!signers?.length) {
    return NextResponse.json({ error: "至少需要一位签署方" }, { status: 400 });
  }

  if (!fields?.length) {
    return NextResponse.json({ error: "至少需要一个签署字段" }, { status: 400 });
  }

  // Delete existing processes for this document
  await prisma.signField.deleteMany({ where: { documentId: id } });
  await prisma.signingProcess.deleteMany({ where: { documentId: id } });

  // Create signing processes
  const createdProcesses = [];
  for (const signer of signers) {
    const process = await prisma.signingProcess.create({
      data: {
        documentId: id,
        signerName: signer.name,
        signerEmail: signer.email,
        order: signer.order,
      },
    });
    createdProcesses.push(process);
  }

  // Create fields linked to their respective signing processes
  for (const field of fields) {
    const process = createdProcesses[field.signerIndex];
    if (!process) continue;

    await prisma.signField.create({
      data: {
        type: field.type,
        page: field.page,
        x: field.x,
        y: field.y,
        width: field.width,
        height: field.height,
        label: field.label,
        signingProcessId: process.id,
        documentId: id,
      },
    });
  }

  // Update document status
  await prisma.document.update({
    where: { id },
    data: { status: "pending" },
  });

  // Send invitation emails and track results
  const baseUrl = process.env.NEXTAUTH_URL || "http://localhost:3000";
  const emailResults: { email: string; success: boolean; error?: string }[] = [];

  for (const proc of createdProcesses) {
    try {
      await sendSigningInvitation({
        to: proc.signerEmail,
        signerName: proc.signerName,
        documentName: document.name,
        senderName: session.user.name || session.user.email || "用户",
        signUrl: `${baseUrl}/sign/${proc.token}`,
      });
      emailResults.push({ email: proc.signerEmail, success: true });
    } catch (e) {
      const errMsg = e instanceof Error ? e.message : "未知错误";
      console.error(`Failed to send email to ${proc.signerEmail}:`, e);
      emailResults.push({ email: proc.signerEmail, success: false, error: errMsg });
    }
  }

  const failedEmails = emailResults.filter((r) => !r.success);

  if (failedEmails.length === emailResults.length) {
    return NextResponse.json(
      {
        success: false,
        error: "所有邮件发送失败，请检查邮件服务配置",
        emailResults,
        processes: createdProcesses,
      },
      { status: 502 }
    );
  }

  return NextResponse.json({
    success: true,
    processes: createdProcesses,
    emailResults,
    warning: failedEmails.length > 0
      ? `${failedEmails.length} 封邮件发送失败：${failedEmails.map((f) => f.email).join("、")}`
      : undefined,
  });
}
