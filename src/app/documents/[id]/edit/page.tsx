import { getServerSession } from "next-auth";
import { redirect } from "next/navigation";
import { notFound } from "next/navigation";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { DocumentEditorWrapper } from "./wrapper";

export default async function DocumentEditPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const session = await getServerSession(authOptions);
  if (!session?.user?.id) redirect("/login");

  const { id } = await params;

  const document = await prisma.document.findUnique({
    where: { id, ownerId: session.user.id },
    include: {
      signingProcesses: { include: { signFields: true }, orderBy: { order: "asc" } },
    },
  });

  if (!document) notFound();

  const serializedDoc = {
    id: document.id,
    name: document.name,
    signingProcesses: document.signingProcesses.map((sp) => ({
      id: sp.id,
      signerName: sp.signerName,
      signerEmail: sp.signerEmail,
      order: sp.order,
      signFields: sp.signFields.map((f) => ({
        id: f.id,
        type: f.type,
        page: f.page,
        x: f.x,
        y: f.y,
        width: f.width,
        height: f.height,
        label: f.label,
      })),
    })),
  };

  return <DocumentEditorWrapper document={serializedDoc} />;
}
