"use client";

import { useState, useRef, useCallback } from "react";
import { Document, Page, pdfjs } from "react-pdf";
import "react-pdf/dist/Page/AnnotationLayer.css";
import "react-pdf/dist/Page/TextLayer.css";
import Link from "next/link";
import { useRouter } from "next/navigation";

pdfjs.GlobalWorkerOptions.workerSrc = "/pdf.worker.min.mjs";

type FieldType = "signature" | "date" | "text";

interface PlacedField {
  id: string;
  type: FieldType;
  page: number;
  x: number;
  y: number;
  width: number;
  height: number;
  label: string;
  signerIndex: number;
}

interface Signer {
  name: string;
  email: string;
  order: number;
}

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

const FIELD_DEFAULTS: Record<FieldType, { width: number; height: number; label: string }> = {
  signature: { width: 200, height: 60, label: "签名" },
  date: { width: 150, height: 36, label: "日期" },
  text: { width: 180, height: 36, label: "文本" },
};

const SIGNER_COLORS = [
  "border-blue-500 bg-blue-50",
  "border-green-500 bg-green-50",
  "border-purple-500 bg-purple-50",
  "border-orange-500 bg-orange-50",
];

export function DocumentEditorClient({ document }: { document: DocumentData }) {
  const router = useRouter();
  const [numPages, setNumPages] = useState(0);
  const [pageNumber, setPageNumber] = useState(1);
  const [scale, setScale] = useState(1.0);
  const [fields, setFields] = useState<PlacedField[]>(() => {
    // Load existing fields if any
    const existing: PlacedField[] = [];
    document.signingProcesses.forEach((sp, signerIdx) => {
      sp.signFields.forEach((f) => {
        existing.push({
          id: f.id,
          type: f.type as FieldType,
          page: f.page,
          x: f.x,
          y: f.y,
          width: f.width,
          height: f.height,
          label: f.label || FIELD_DEFAULTS[f.type as FieldType]?.label || f.type,
          signerIndex: signerIdx,
        });
      });
    });
    return existing;
  });
  const [signers, setSigners] = useState<Signer[]>(() => {
    if (document.signingProcesses.length > 0) {
      return document.signingProcesses.map((sp) => ({
        name: sp.signerName,
        email: sp.signerEmail,
        order: sp.order,
      }));
    }
    return [{ name: "", email: "", order: 1 }];
  });
  const [activeSignerIndex, setActiveSignerIndex] = useState(0);
  const [dragType, setDragType] = useState<FieldType | null>(null);
  const [draggingField, setDraggingField] = useState<string | null>(null);
  const [dragOffset, setDragOffset] = useState({ x: 0, y: 0 });
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState("");
  const pdfContainerRef = useRef<HTMLDivElement>(null);

  const handleDrop = useCallback(
    (e: React.MouseEvent) => {
      if (!dragType && !draggingField) return;
      const container = pdfContainerRef.current;
      if (!container) return;

      const rect = container.getBoundingClientRect();
      const x = (e.clientX - rect.left - dragOffset.x) / scale;
      const y = (e.clientY - rect.top - dragOffset.y) / scale;

      if (draggingField) {
        setFields((prev) =>
          prev.map((f) => (f.id === draggingField ? { ...f, x, y } : f))
        );
        setDraggingField(null);
      } else if (dragType) {
        const defaults = FIELD_DEFAULTS[dragType];
        const newField: PlacedField = {
          id: `field-${Date.now()}-${Math.random().toString(36).slice(2)}`,
          type: dragType,
          page: pageNumber,
          x,
          y,
          width: defaults.width,
          height: defaults.height,
          label: defaults.label,
          signerIndex: activeSignerIndex,
        };
        setFields((prev) => [...prev, newField]);
      }
      setDragType(null);
      setDragOffset({ x: 0, y: 0 });
    },
    [dragType, draggingField, dragOffset, pageNumber, scale, activeSignerIndex]
  );

  const removeField = (id: string) => {
    setFields((prev) => prev.filter((f) => f.id !== id));
  };

  const addSigner = () => {
    setSigners((prev) => [...prev, { name: "", email: "", order: prev.length + 1 }]);
  };

  const removeSigner = (index: number) => {
    if (signers.length <= 1) return;
    setSigners((prev) => prev.filter((_, i) => i !== index).map((s, i) => ({ ...s, order: i + 1 })));
    setFields((prev) => prev.filter((f) => f.signerIndex !== index).map((f) => ({
      ...f,
      signerIndex: f.signerIndex > index ? f.signerIndex - 1 : f.signerIndex,
    })));
    if (activeSignerIndex >= index && activeSignerIndex > 0) {
      setActiveSignerIndex(activeSignerIndex - 1);
    }
  };

  const updateSigner = (index: number, key: keyof Signer, value: string | number) => {
    setSigners((prev) => prev.map((s, i) => (i === index ? { ...s, [key]: value } : s)));
  };

  const handleSubmit = async () => {
    // Validate signers
    for (const signer of signers) {
      if (!signer.name.trim() || !signer.email.trim()) {
        setError("请填写所有签署方的姓名和邮箱");
        return;
      }
    }
    if (fields.length === 0) {
      setError("请至少添加一个签署字段");
      return;
    }

    setSubmitting(true);
    setError("");

    try {
      const res = await fetch(`/api/documents/${document.id}/signing-processes`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          signers,
          fields: fields.map((f) => ({
            type: f.type,
            page: f.page,
            x: f.x,
            y: f.y,
            width: f.width,
            height: f.height,
            label: f.label,
            signerIndex: f.signerIndex,
          })),
        }),
      });

      if (!res.ok) {
        const data = await res.json();
        throw new Error(data.error || "创建签署流程失败");
      }

      router.push(`/documents/${document.id}`);
    } catch (e) {
      setError(e instanceof Error ? e.message : "创建签署流程失败");
    } finally {
      setSubmitting(false);
    }
  };

  const currentPageFields = fields.filter((f) => f.page === pageNumber);

  return (
    <div className="h-screen flex flex-col">
      {/* Header */}
      <div className="border-b bg-white px-4 py-3 flex items-center justify-between shrink-0">
        <div className="flex items-center gap-4">
          <Link href={`/documents/${document.id}`} className="text-sm text-blue-600 hover:underline">
            &larr; 返回
          </Link>
          <h1 className="text-lg font-semibold">{document.name} - 编辑签署字段</h1>
        </div>
        <button
          onClick={handleSubmit}
          disabled={submitting}
          className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50"
        >
          {submitting ? "发送中..." : "发起签署"}
        </button>
      </div>

      {error && (
        <div className="bg-red-50 border-b border-red-200 px-4 py-2 text-red-700 text-sm">
          {error}
        </div>
      )}

      <div className="flex flex-1 overflow-hidden">
        {/* Left sidebar - Signers & Fields */}
        <div className="w-80 border-r bg-gray-50 overflow-y-auto p-4 shrink-0">
          {/* Signers */}
          <div className="mb-6">
            <h3 className="text-sm font-semibold text-gray-700 mb-2">签署方</h3>
            <div className="space-y-3">
              {signers.map((signer, idx) => (
                <div
                  key={idx}
                  className={`p-3 rounded-lg border-2 cursor-pointer transition ${
                    activeSignerIndex === idx
                      ? SIGNER_COLORS[idx % SIGNER_COLORS.length]
                      : "border-gray-200 bg-white"
                  }`}
                  onClick={() => setActiveSignerIndex(idx)}
                >
                  <div className="flex items-center justify-between mb-2">
                    <span className="text-xs font-medium text-gray-500">
                      签署方 {idx + 1} (顺序: {signer.order})
                    </span>
                    {signers.length > 1 && (
                      <button
                        onClick={(e) => { e.stopPropagation(); removeSigner(idx); }}
                        className="text-red-400 hover:text-red-600 text-xs"
                      >
                        删除
                      </button>
                    )}
                  </div>
                  <input
                    type="text"
                    placeholder="姓名"
                    value={signer.name}
                    onChange={(e) => updateSigner(idx, "name", e.target.value)}
                    className="w-full px-2 py-1 text-sm border rounded mb-1"
                    onClick={(e) => e.stopPropagation()}
                  />
                  <input
                    type="email"
                    placeholder="邮箱"
                    value={signer.email}
                    onChange={(e) => updateSigner(idx, "email", e.target.value)}
                    className="w-full px-2 py-1 text-sm border rounded"
                    onClick={(e) => e.stopPropagation()}
                  />
                </div>
              ))}
            </div>
            <button
              onClick={addSigner}
              className="mt-2 w-full px-3 py-2 text-sm border-2 border-dashed border-gray-300 rounded-lg hover:border-gray-400 text-gray-500"
            >
              + 添加签署方
            </button>
          </div>

          {/* Field Palette */}
          <div>
            <h3 className="text-sm font-semibold text-gray-700 mb-2">拖拽字段到文档</h3>
            <p className="text-xs text-gray-400 mb-3">
              为「签署方 {activeSignerIndex + 1}」放置字段
            </p>
            <div className="space-y-2">
              {(["signature", "date", "text"] as FieldType[]).map((type) => (
                <div
                  key={type}
                  className="px-3 py-2 bg-white border rounded-lg cursor-grab hover:shadow-sm active:cursor-grabbing select-none"
                  onMouseDown={(e) => {
                    e.preventDefault();
                    setDragType(type);
                    setDragOffset({ x: 0, y: 0 });
                  }}
                >
                  <span className="text-sm font-medium">
                    {type === "signature" && "✍️ 签名字段"}
                    {type === "date" && "📅 日期字段"}
                    {type === "text" && "📝 文本字段"}
                  </span>
                </div>
              ))}
            </div>
          </div>

          {/* Placed fields list */}
          {fields.length > 0 && (
            <div className="mt-6">
              <h3 className="text-sm font-semibold text-gray-700 mb-2">
                已放置字段 ({fields.length})
              </h3>
              <div className="space-y-1">
                {fields.map((f) => (
                  <div
                    key={f.id}
                    className="flex items-center justify-between px-2 py-1 text-xs bg-white border rounded"
                  >
                    <span>
                      {f.label} - 第{f.page}页 (签署方{f.signerIndex + 1})
                    </span>
                    <button
                      onClick={() => removeField(f.id)}
                      className="text-red-400 hover:text-red-600"
                    >
                      ×
                    </button>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>

        {/* PDF Viewer with overlay */}
        <div className="flex-1 flex flex-col overflow-hidden bg-gray-200">
          {/* Page controls */}
          <div className="flex items-center justify-center gap-4 py-2 bg-white border-b">
            <button
              onClick={() => setPageNumber(Math.max(1, pageNumber - 1))}
              disabled={pageNumber <= 1}
              className="px-2 py-1 text-sm border rounded disabled:opacity-50 hover:bg-gray-50"
            >
              上一页
            </button>
            <span className="text-sm text-gray-600">
              {pageNumber} / {numPages || "..."}
            </span>
            <button
              onClick={() => setPageNumber(Math.min(numPages, pageNumber + 1))}
              disabled={pageNumber >= numPages}
              className="px-2 py-1 text-sm border rounded disabled:opacity-50 hover:bg-gray-50"
            >
              下一页
            </button>
            <div className="w-px h-6 bg-gray-200" />
            <button
              onClick={() => setScale(Math.max(0.5, scale - 0.25))}
              disabled={scale <= 0.5}
              className="px-2 py-1 text-sm border rounded disabled:opacity-50 hover:bg-gray-50"
            >
              -
            </button>
            <span className="text-sm text-gray-600 w-12 text-center">
              {Math.round(scale * 100)}%
            </span>
            <button
              onClick={() => setScale(Math.min(2, scale + 0.25))}
              disabled={scale >= 2}
              className="px-2 py-1 text-sm border rounded disabled:opacity-50 hover:bg-gray-50"
            >
              +
            </button>
          </div>

          {/* PDF + Fields overlay */}
          <div className="flex-1 overflow-auto flex justify-center p-4">
            <div
              ref={pdfContainerRef}
              className="relative inline-block"
              style={{ cursor: dragType ? "crosshair" : "default" }}
              onClick={handleDrop}
            >
              <Document
                file={`/api/documents/${document.id}/file`}
                onLoadSuccess={({ numPages }) => setNumPages(numPages)}
                loading=""
              >
                <Page
                  pageNumber={pageNumber}
                  scale={scale}
                  renderTextLayer={false}
                  renderAnnotationLayer={false}
                />
              </Document>

              {/* Placed fields overlay */}
              {currentPageFields.map((field) => (
                <div
                  key={field.id}
                  className={`absolute border-2 rounded flex items-center justify-center cursor-move group ${
                    SIGNER_COLORS[field.signerIndex % SIGNER_COLORS.length]
                  }`}
                  style={{
                    left: field.x * scale,
                    top: field.y * scale,
                    width: field.width * scale,
                    height: field.height * scale,
                  }}
                  onMouseDown={(e) => {
                    e.stopPropagation();
                    const container = pdfContainerRef.current;
                    if (!container) return;
                    const rect = container.getBoundingClientRect();
                    setDraggingField(field.id);
                    setDragOffset({
                      x: e.clientX - rect.left - field.x * scale,
                      y: e.clientY - rect.top - field.y * scale,
                    });
                  }}
                >
                  <span className="text-xs text-gray-600 pointer-events-none select-none">
                    {field.label}
                  </span>
                  <button
                    onClick={(e) => { e.stopPropagation(); removeField(field.id); }}
                    className="absolute -top-2 -right-2 w-5 h-5 bg-red-500 text-white rounded-full text-xs opacity-0 group-hover:opacity-100 transition flex items-center justify-center"
                  >
                    ×
                  </button>
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
