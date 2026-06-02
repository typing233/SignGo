"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";

interface DocumentCardProps {
  id: string;
  name: string;
  fileSize: number;
  status: string;
  createdAt: string;
}

export function DocumentCard({ id, name, fileSize, status, createdAt }: DocumentCardProps) {
  const router = useRouter();
  const [showMenu, setShowMenu] = useState(false);
  const [renaming, setRenaming] = useState(false);
  const [newName, setNewName] = useState(name);
  const [deleting, setDeleting] = useState(false);

  const statusLabels: Record<string, { text: string; color: string }> = {
    uploaded: { text: "已上传", color: "bg-gray-100 text-gray-700" },
    pending: { text: "待签署", color: "bg-yellow-100 text-yellow-700" },
    signed: { text: "已签署", color: "bg-green-100 text-green-700" },
    rejected: { text: "已拒绝", color: "bg-red-100 text-red-700" },
  };

  const statusInfo = statusLabels[status] || statusLabels.uploaded;

  async function handleRename() {
    if (!newName.trim() || newName === name) {
      setRenaming(false);
      return;
    }

    await fetch(`/api/documents/${id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ name: newName.trim() }),
    });

    setRenaming(false);
    router.refresh();
  }

  async function handleDelete() {
    if (!confirm("确定要删除这个文档吗？此操作无法撤销。")) return;
    setDeleting(true);

    await fetch(`/api/documents/${id}`, { method: "DELETE" });

    router.refresh();
  }

  function formatFileSize(bytes: number) {
    if (bytes < 1024) return `${bytes} B`;
    if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
    return `${(bytes / 1024 / 1024).toFixed(2)} MB`;
  }

  return (
    <div className={`bg-white rounded-lg border p-4 hover:shadow-md transition-shadow ${deleting ? "opacity-50" : ""}`}>
      <div className="flex items-start justify-between">
        <Link href={`/documents/${id}`} className="flex-1 min-w-0">
          {renaming ? (
            <input
              autoFocus
              value={newName}
              onChange={(e) => setNewName(e.target.value)}
              onBlur={handleRename}
              onKeyDown={(e) => { if (e.key === "Enter") handleRename(); if (e.key === "Escape") setRenaming(false); }}
              className="w-full px-2 py-1 border rounded text-sm"
              onClick={(e) => e.preventDefault()}
            />
          ) : (
            <h3 className="font-medium text-gray-900 truncate">{name}</h3>
          )}
          <div className="flex items-center gap-3 mt-2 text-xs text-gray-500">
            <span>{formatFileSize(fileSize)}</span>
            <span>{new Date(createdAt).toLocaleDateString("zh-CN")}</span>
            <span className={`px-2 py-0.5 rounded-full text-xs ${statusInfo.color}`}>
              {statusInfo.text}
            </span>
          </div>
        </Link>

        <div className="relative ml-2">
          <button
            onClick={() => setShowMenu(!showMenu)}
            className="p-1 text-gray-400 hover:text-gray-600 rounded"
          >
            <svg className="w-5 h-5" fill="currentColor" viewBox="0 0 20 20">
              <path d="M10 6a2 2 0 110-4 2 2 0 010 4zM10 12a2 2 0 110-4 2 2 0 010 4zM10 18a2 2 0 110-4 2 2 0 010 4z" />
            </svg>
          </button>

          {showMenu && (
            <div className="absolute right-0 top-8 bg-white border rounded-lg shadow-lg py-1 z-10 w-28">
              <button
                onClick={() => { setShowMenu(false); setRenaming(true); }}
                className="w-full text-left px-4 py-2 text-sm hover:bg-gray-50"
              >
                重命名
              </button>
              <button
                onClick={() => { setShowMenu(false); handleDelete(); }}
                className="w-full text-left px-4 py-2 text-sm text-red-600 hover:bg-red-50"
              >
                删除
              </button>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
