import { NextResponse } from "next/server";
import { readFile } from "fs/promises";
import { join } from "path";
import { prisma } from "@/lib/prisma";

type RouteParams = { params: Promise<{ token: string }> };

export async function GET(_request: Request, { params }: RouteParams) {
  const { token } = await params;

  const signingProcess = await prisma.signingProcess.findUnique({
    where: { token },
    include: { document: true },
  });

  if (!signingProcess) {
    return NextResponse.json({ error: "签署链接无效" }, { status: 404 });
  }

  const absolutePath = join(process.cwd(), signingProcess.document.filePath);
  try {
    const fileBuffer = await readFile(absolutePath);
    return new NextResponse(fileBuffer, {
      headers: {
        "Content-Type": "application/pdf",
        "Content-Disposition": `inline; filename="${signingProcess.document.name}"`,
      },
    });
  } catch {
    return NextResponse.json({ error: "文件不存在" }, { status: 404 });
  }
}
