import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // Required for YouTube embeds (Error 153 without a Referer).
  async headers() {
    return [
      {
        source: "/:path*",
        headers: [
          {
            key: "Referrer-Policy",
            value: "strict-origin-when-cross-origin",
          },
        ],
      },
    ];
  },
};

export default nextConfig;
