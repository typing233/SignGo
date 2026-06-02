"use client";

import { useSession, signOut } from "next-auth/react";
import Link from "next/link";

export function Navbar() {
  const { data: session } = useSession();

  if (!session) return null;

  return (
    <nav className="border-b bg-white px-6 py-3 flex items-center justify-between">
      <Link href="/dashboard" className="text-xl font-bold text-blue-600">
        SignGo
      </Link>
      <div className="flex items-center gap-4">
        <span className="text-sm text-gray-600">{session.user?.email}</span>
        <button
          onClick={() => signOut({ callbackUrl: "/login" })}
          className="text-sm text-gray-500 hover:text-gray-700"
        >
          退出登录
        </button>
      </div>
    </nav>
  );
}
