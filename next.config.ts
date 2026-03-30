import type { NextConfig } from "next";

const marketingRouteRewrites = [
  "/about",
  "/services",
  "/contact",
  "/pricing",
  "/login",
];

const nextConfig: NextConfig = {
  async rewrites() {
    return marketingRouteRewrites.map((source) => ({
      source,
      destination: "/office",
    }));
  },
};

export default nextConfig;
