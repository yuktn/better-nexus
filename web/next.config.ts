import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // Allow dev assets and hot reload when accessing the server over Tailscale.
  allowedDevOrigins: ["100.83.1.6"],
};

export default nextConfig;
