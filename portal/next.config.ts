import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  poweredByHeader: false,
  async headers() {
    const lock = [
      { key: "X-Robots-Tag", value: "noindex, nofollow, noarchive" },
      { key: "Cache-Control", value: "private, no-store" },
      { key: "Referrer-Policy", value: "no-referrer" },
      { key: "X-Content-Type-Options", value: "nosniff" },
    ];
    return [
      { source: "/:vertical/portal/:token", headers: lock },
      { source: "/api/:path*", headers: lock },
    ];
  },
};

export default nextConfig;
