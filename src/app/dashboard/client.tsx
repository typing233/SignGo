"use client";

import { useState } from "react";
import { DocumentCard } from "@/components/document-card";
import { UploadDialog } from "@/components/upload-dialog";

interface Document {
  id: string;
  name: string;
  fileSize: number;
  status: string;
  createdAt: string;
}

export function DashboardClient({ documents }: { documents: Document[] }) {
  const [showUpload, setShowUpload] = useState(false);

  return (
    <div className="max-w-4xl mx-auto px-4 py-8">
      <div className="flex items-center justify-between mb-6">
        <h1 className="text-2xl font-bold text-gray-900">我的文档</h1>
        <button
          onClick={() => setShowUpload(true)}
          className="px-4 py-2 bg-blue-600 text-white text-sm font-medium rounded hover:bg-blue-700"
        >
          上传文档
        </button>
      </div>

      {documents.length === 0 ? (
        <div className="text-center py-16 bg-white rounded-lg border">
          <p className="text-gray-500">暂无文档</p>
          <p className="text-sm text-gray-400 mt-1">点击上方按钮上传您的第一个PDF文档</p>
        </div>
      ) : (
        <div className="space-y-3">
          {documents.map((doc) => (
            <DocumentCard
              key={doc.id}
              id={doc.id}
              name={doc.name}
              fileSize={doc.fileSize}
              status={doc.status}
              createdAt={doc.createdAt}
            />
          ))}
        </div>
      )}

      {showUpload && <UploadDialog onClose={() => setShowUpload(false)} />}
    </div>
  );
}
