import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // El cliente de Prisma se genera en el build. Sin esto, Vercel despliega el
  // cliente que quedó del último `prisma generate` local — o ninguno.
  serverExternalPackages: ["@prisma/client", "@neondatabase/serverless"],
};

export default nextConfig;
