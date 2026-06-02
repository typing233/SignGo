"use client";

import { useState } from "react";
import { Document, Page, pdfjs } from "react-pdf";
import "react-pdf/dist/Page/AnnotationLayer.css";
import "react-pdf/dist/Page/TextLayer.css";

pdfjs.GlobalWorkerOptions.workerSrc = "/pdf.worker.min.mjs";

interface PdfViewerProps {
  url: string;
}

export function PdfViewer({ url }: PdfViewerProps) {
  const [numPages, setNumPages] = useState<number>(0);
  const [pageNumber, setPageNumber] = useState(1);
  const [scale, setScale] = useState(1.0);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(false);

  function onDocumentLoadSuccess({ numPages }: { numPages: number }) {
    setNumPages(numPages);
    setLoading(false);
  }

  function onDocumentLoadError() {
    setError(true);
    setLoading(false);
  }

  if (error) {
    return (
      <div className="flex items-center justify-center h-96 bg-gray-100 rounded-lg">
        <p className="text-gray-500">PDF加载失败</p>
      </div>
    );
  }

  return (
    <div className="flex flex-col items-center">
      <div className="flex items-center gap-4 mb-4 bg-white border rounded-lg px-4 py-2">
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

      <div className="border rounded-lg overflow-auto bg-gray-100 p-4 max-h-[700px] w-full flex justify-center">
        {loading && (
          <div className="flex items-center justify-center h-96">
            <p className="text-gray-500">加载中...</p>
          </div>
        )}
        <Document
          file={url}
          onLoadSuccess={onDocumentLoadSuccess}
          onLoadError={onDocumentLoadError}
          loading=""
        >
          <Page
            pageNumber={pageNumber}
            scale={scale}
            renderTextLayer={true}
            renderAnnotationLayer={true}
          />
        </Document>
      </div>
    </div>
  );
}
