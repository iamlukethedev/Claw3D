import type { NextConfig } from "next";
import path from "node:path";
import { fileURLToPath } from "node:url";

const repositoryRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "../..");

const nextConfig: NextConfig = {
  outputFileTracingRoot: repositoryRoot,
  turbopack: { root: repositoryRoot },
  transpilePackages: [
    "@claw3d/visual-contract",
    "@claw3d/visual-core",
    "@claw3d/visual-react",
    "@claw3d/adapter-mock",
    "@claw3d/adapter-null",
    "@claw3d/adapter-jarvis-readonly",
  ],
  poweredByHeader: false,
};

export default nextConfig;
