"use client";

import dynamic from "next/dynamic";

const DocumentEditorClient = dynamic(
  () => import("./client").then((mod) => mod.DocumentEditorClient),
  {
    ssr: false,
    loading: () => (
      <div className="flex items-center justify-center h-screen">
        <p className="text-gray-500">加载编辑器...</p>
      </div>
    ),
  }
);

interface DocumentData {
  id: string;
  name: string;
  signingProcesses: {
    id: string;
    signerName: string;
    signerEmail: string;
    order: number;
    signFields: {
      id: string;
      type: string;
      page: number;
      x: number;
      y: number;
      width: number;
      height: number;
      label: string | null;
    }[];
  }[];
}

export function DocumentEditorWrapper({ document }: { document: DocumentData }) {
  return <DocumentEditorClient document={document} />;
}
