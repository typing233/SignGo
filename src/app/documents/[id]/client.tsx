"use client";

import dynamic from "next/dynamic";

const PdfViewer = dynamic(
  () => import("@/components/pdf-viewer").then((mod) => mod.PdfViewer),
  { ssr: false, loading: () => <div className="flex items-center justify-center h-96"><p className="text-gray-500">加载PDF查看器...</p></div> }
);

export function DocumentDetailClient({ documentId }: { documentId: string }) {
  return <PdfViewer url={`/api/documents/${documentId}/file`} />;
}
