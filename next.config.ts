import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  serverExternalPackages: ["@prisma/client", "bcryptjs"],
  turbopack: {
    resolveAlias: {
      canvas: "",
    },
  },
};

export default nextConfig;
