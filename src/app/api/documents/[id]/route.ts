import { NextResponse } from "next/server";
import { unlink } from "fs/promises";
import { join } from "path";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { renameDocumentSchema } from "@/lib/validations";

type RouteParams = { params: Promise<{ id: string }> };

export async function GET(_request: Request, { params }: RouteParams) {
  const session = await getServerSession(authOptions);
  if (!session?.user?.id) {
    return NextResponse.json({ error: "未授权" }, { status: 401 });
  }

  const { id } = await params;

  const document = await prisma.document.findUnique({
    where: { id, ownerId: session.user.id },
    include: { signingProcesses: true },
  });

  if (!document) {
    return NextResponse.json({ error: "文档不存在" }, { status: 404 });
  }

  return NextResponse.json(document);
}

export async function PATCH(request: Request, { params }: RouteParams) {
  const session = await getServerSession(authOptions);
  if (!session?.user?.id) {
    return NextResponse.json({ error: "未授权" }, { status: 401 });
  }

  const { id } = await params;
  const body = await request.json();
  const result = renameDocumentSchema.safeParse(body);

  if (!result.success) {
    return NextResponse.json(
      { error: result.error.issues[0].message },
      { status: 400 }
    );
  }

  const document = await prisma.document.findUnique({
    where: { id, ownerId: session.user.id },
  });

  if (!document) {
    return NextResponse.json({ error: "文档不存在" }, { status: 404 });
  }

  const updated = await prisma.document.update({
    where: { id },
    data: { name: result.data.name },
  });

  return NextResponse.json(updated);
}

export async function DELETE(_request: Request, { params }: RouteParams) {
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

  try {
    const absolutePath = join(process.cwd(), document.filePath);
    await unlink(absolutePath);
  } catch {
    // File may not exist on disk, continue with DB deletion
  }

  await prisma.document.delete({ where: { id } });

  return NextResponse.json({ success: true });
}
