import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  typescript: {
    ignoreBuildErrors: true,
  },
  eslint: {
    ignoreDuringBuilds: true,
  },
  async rewrites() {
    return {
      beforeFiles: [
        { source: '/about', destination: '/' },
        { source: '/services', destination: '/' },
        { source: '/contact', destination: '/' },
        { source: '/pricing', destination: '/' },
        { source: '/login', destination: '/' },
        { source: '/apply', destination: '/' },
      ],
    };
  },
};

export default nextConfig;
