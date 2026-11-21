import type { NextConfig } from "next";
const nextConfig: NextConfig = {
  poweredByHeader: false,
  serverExternalPackages: ["exceljs", "jspdf", "jspdf-autotable"],
};
export default nextConfig;
