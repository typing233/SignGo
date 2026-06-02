"use client";

import dynamic from "next/dynamic";

const SignPageContent = dynamic(
  () => import("./client").then((mod) => mod.SignPageClient),
  {
    ssr: false,
    loading: () => (
      <div className="flex items-center justify-center min-h-screen">
        <p className="text-gray-500">加载中...</p>
      </div>
    ),
  }
);

export default function SignPage() {
  return <SignPageContent />;
}
