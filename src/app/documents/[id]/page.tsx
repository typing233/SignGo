import { getServerSession } from "next-auth";
import { redirect } from "next/navigation";
import { notFound } from "next/navigation";
import Link from "next/link";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { DocumentDetailClient } from "./client";

export default async function DocumentDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const session = await getServerSession(authOptions);
  if (!session?.user?.id) redirect("/login");

  const { id } = await params;

  const document = await prisma.document.findUnique({
    where: { id, ownerId: session.user.id },
    include: { signingProcesses: true },
  });

  if (!document) notFound();

  const statusLabels: Record<string, string> = {
    uploaded: "已上传",
    pending: "待签署",
    signed: "已签署",
    rejected: "已拒绝",
  };

  function formatFileSize(bytes: number) {
    if (bytes < 1024) return `${bytes} B`;
    if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
    return `${(bytes / 1024 / 1024).toFixed(2)} MB`;
  }

  return (
    <div className="max-w-5xl mx-auto px-4 py-8">
      <div className="mb-6">
        <Link href="/dashboard" className="text-sm text-blue-600 hover:underline">
          &larr; 返回文档列表
        </Link>
      </div>

      <div className="bg-white rounded-lg border p-6 mb-6">
        <h1 className="text-xl font-bold text-gray-900">{document.name}</h1>
        <div className="flex items-center gap-4 mt-2 text-sm text-gray-500">
          <span>大小: {formatFileSize(document.fileSize)}</span>
          <span>状态: {statusLabels[document.status] || document.status}</span>
          <span>上传时间: {new Date(document.createdAt).toLocaleString("zh-CN")}</span>
        </div>
        <div className="mt-4">
          <Link
            href={`/documents/${document.id}/edit`}
            className="inline-block px-4 py-2 bg-blue-600 text-white text-sm rounded-lg hover:bg-blue-700"
          >
            设置签署字段
          </Link>
        </div>
      </div>

      {document.signingProcesses.length > 0 && (
        <div className="bg-white rounded-lg border p-6 mb-6">
          <h2 className="text-lg font-semibold mb-3">签署流程</h2>
          <div className="space-y-2">
            {document.signingProcesses.map((sp) => (
              <div key={sp.id} className="flex items-center justify-between py-2 border-b last:border-0">
                <div>
                  <span className="font-medium">{sp.signerName}</span>
                  <span className="text-sm text-gray-500 ml-2">{sp.signerEmail}</span>
                </div>
                <span className="text-sm">
                  {sp.status === "pending" && "待签署"}
                  {sp.status === "signed" && "已签署"}
                  {sp.status === "rejected" && "已拒绝"}
                </span>
              </div>
            ))}
          </div>
        </div>
      )}

      <div className="bg-white rounded-lg border p-6">
        <h2 className="text-lg font-semibold mb-4">文档预览</h2>
        <DocumentDetailClient documentId={document.id} />
      </div>
    </div>
  );
}
