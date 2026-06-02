"use client";

import { useState, useEffect, useRef, useCallback } from "react";
import { useParams } from "next/navigation";
import { Document, Page, pdfjs } from "react-pdf";
import "react-pdf/dist/Page/AnnotationLayer.css";
import "react-pdf/dist/Page/TextLayer.css";

pdfjs.GlobalWorkerOptions.workerSrc = "/pdf.worker.min.mjs";

interface SignField {
  id: string;
  type: string;
  page: number;
  x: number;
  y: number;
  width: number;
  height: number;
  label: string | null;
  value: string | null;
}

interface SignData {
  process: {
    id: string;
    signerName: string;
    signerEmail: string;
    status: string;
    order: number;
  };
  document: {
    id: string;
    name: string;
  };
  fields: SignField[];
}

export function SignPageClient() {
  const params = useParams();
  const token = params.token as string;

  const [data, setData] = useState<SignData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [signed, setSigned] = useState(false);
  const [numPages, setNumPages] = useState(0);
  const [pageNumber, setPageNumber] = useState(1);
  const [scale, setScale] = useState(1.0);
  const [fieldValues, setFieldValues] = useState<Record<string, string>>({});
  const [signatureData, setSignatureData] = useState<string>("");
  const [submitting, setSubmitting] = useState(false);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [isDrawing, setIsDrawing] = useState(false);
  const [showSignPad, setShowSignPad] = useState(false);
  const [activeFieldId, setActiveFieldId] = useState<string | null>(null);

  useEffect(() => {
    fetch(`/api/sign/${token}`)
      .then((res) => res.json())
      .then((data) => {
        if (data.error) {
          setError(data.error);
          if (data.signed) setSigned(true);
        } else {
          setData(data);
          const initialValues: Record<string, string> = {};
          data.fields.forEach((f: SignField) => {
            if (f.value) initialValues[f.id] = f.value;
          });
          setFieldValues(initialValues);
        }
      })
      .catch(() => setError("加载失败"))
      .finally(() => setLoading(false));
  }, [token]);

  const startDrawing = useCallback((e: React.MouseEvent<HTMLCanvasElement>) => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;
    setIsDrawing(true);
    const rect = canvas.getBoundingClientRect();
    ctx.beginPath();
    ctx.moveTo(e.clientX - rect.left, e.clientY - rect.top);
  }, []);

  const draw = useCallback((e: React.MouseEvent<HTMLCanvasElement>) => {
    if (!isDrawing) return;
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;
    const rect = canvas.getBoundingClientRect();
    ctx.lineWidth = 2;
    ctx.lineCap = "round";
    ctx.strokeStyle = "#000";
    ctx.lineTo(e.clientX - rect.left, e.clientY - rect.top);
    ctx.stroke();
  }, [isDrawing]);

  const stopDrawing = useCallback(() => {
    setIsDrawing(false);
  }, []);

  const clearSignature = () => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;
    ctx.clearRect(0, 0, canvas.width, canvas.height);
  };

  const confirmSignature = () => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const dataUrl = canvas.toDataURL("image/png");
    setSignatureData(dataUrl);
    if (activeFieldId) {
      setFieldValues((prev) => ({ ...prev, [activeFieldId]: dataUrl }));
    }
    setShowSignPad(false);
    setActiveFieldId(null);
  };

  const handleSubmit = async () => {
    if (!data) return;

    // Validate all fields have values
    const missingFields = data.fields.filter((f) => !fieldValues[f.id]);
    if (missingFields.length > 0) {
      setError("请填写所有必填字段");
      return;
    }

    setSubmitting(true);
    setError("");

    try {
      const res = await fetch(`/api/sign/${token}`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          fieldValues: Object.entries(fieldValues).map(([fieldId, value]) => ({
            fieldId,
            value,
          })),
          signatureData,
        }),
      });

      if (!res.ok) {
        const resData = await res.json();
        throw new Error(resData.error || "签署失败");
      }

      setSigned(true);
    } catch (e) {
      setError(e instanceof Error ? e.message : "签署失败");
    } finally {
      setSubmitting(false);
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <p className="text-gray-500">加载中...</p>
      </div>
    );
  }

  if (signed) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <div className="text-center">
          <div className="text-5xl mb-4">✓</div>
          <h1 className="text-2xl font-bold text-gray-900 mb-2">签署完成</h1>
          <p className="text-gray-500">文档已成功签署，感谢您的配合。</p>
        </div>
      </div>
    );
  }

  if (error && !data) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <div className="text-center">
          <h1 className="text-xl font-bold text-red-600 mb-2">无法访问</h1>
          <p className="text-gray-500">{error}</p>
        </div>
      </div>
    );
  }

  if (!data) return null;

  const currentPageFields = data.fields.filter((f) => f.page === pageNumber);

  return (
    <div className="min-h-screen bg-gray-100">
      {/* Header */}
      <div className="bg-white border-b px-4 py-3">
        <div className="max-w-5xl mx-auto flex items-center justify-between">
          <div>
            <h1 className="text-lg font-semibold">{data.document.name}</h1>
            <p className="text-sm text-gray-500">
              签署方：{data.process.signerName} ({data.process.signerEmail})
            </p>
          </div>
          <button
            onClick={handleSubmit}
            disabled={submitting}
            className="px-6 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 disabled:opacity-50"
          >
            {submitting ? "提交中..." : "确认签署"}
          </button>
        </div>
      </div>

      {error && (
        <div className="max-w-5xl mx-auto mt-2 px-4">
          <div className="bg-red-50 border border-red-200 rounded px-3 py-2 text-red-700 text-sm">
            {error}
          </div>
        </div>
      )}

      {/* PDF Viewer with fields */}
      <div className="max-w-5xl mx-auto py-4 px-4">
        {/* Page controls */}
        <div className="flex items-center justify-center gap-4 mb-4 bg-white border rounded-lg px-4 py-2">
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

        {/* PDF + Field Overlays */}
        <div className="flex justify-center">
          <div className="relative inline-block">
            <Document
              file={`/api/sign/${token}/file`}
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

            {/* Field overlays */}
            {currentPageFields.map((field) => (
              <div
                key={field.id}
                className="absolute border-2 border-blue-400 rounded bg-blue-50/80 flex items-center justify-center"
                style={{
                  left: field.x * scale,
                  top: field.y * scale,
                  width: field.width * scale,
                  height: field.height * scale,
                }}
              >
                {field.type === "signature" ? (
                  fieldValues[field.id] ? (
                    <img
                      src={fieldValues[field.id]}
                      alt="签名"
                      className="w-full h-full object-contain p-1 cursor-pointer"
                      onClick={() => {
                        setActiveFieldId(field.id);
                        setShowSignPad(true);
                      }}
                    />
                  ) : (
                    <button
                      onClick={() => {
                        setActiveFieldId(field.id);
                        setShowSignPad(true);
                      }}
                      className="text-xs text-blue-600 hover:text-blue-800"
                    >
                      点击签名
                    </button>
                  )
                ) : field.type === "date" ? (
                  <input
                    type="date"
                    value={fieldValues[field.id] || ""}
                    onChange={(e) =>
                      setFieldValues((prev) => ({ ...prev, [field.id]: e.target.value }))
                    }
                    className="w-full h-full text-xs px-1 bg-transparent border-none outline-none"
                  />
                ) : (
                  <input
                    type="text"
                    placeholder={field.label || "请输入"}
                    value={fieldValues[field.id] || ""}
                    onChange={(e) =>
                      setFieldValues((prev) => ({ ...prev, [field.id]: e.target.value }))
                    }
                    className="w-full h-full text-xs px-1 bg-transparent border-none outline-none"
                  />
                )}
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* Signature Pad Modal */}
      {showSignPad && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
          <div className="bg-white rounded-lg p-6 w-[500px]">
            <h3 className="text-lg font-semibold mb-4">手写签名</h3>
            <div className="border rounded-lg mb-4">
              <canvas
                ref={canvasRef}
                width={460}
                height={200}
                className="w-full cursor-crosshair"
                onMouseDown={startDrawing}
                onMouseMove={draw}
                onMouseUp={stopDrawing}
                onMouseLeave={stopDrawing}
              />
            </div>
            <div className="flex justify-between">
              <button
                onClick={clearSignature}
                className="px-4 py-2 text-sm border rounded-lg hover:bg-gray-50"
              >
                清除
              </button>
              <div className="flex gap-2">
                <button
                  onClick={() => { setShowSignPad(false); setActiveFieldId(null); }}
                  className="px-4 py-2 text-sm border rounded-lg hover:bg-gray-50"
                >
                  取消
                </button>
                <button
                  onClick={confirmSignature}
                  className="px-4 py-2 text-sm bg-blue-600 text-white rounded-lg hover:bg-blue-700"
                >
                  确认
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
