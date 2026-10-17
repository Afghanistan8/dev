import type { NextConfig } from "next";

const config: NextConfig = {
  reactStrictMode: true,
  typescript: { ignoreBuildErrors: false },
  // The repository root carries its own lockfile for the deploy and live
  // scripts, so say plainly that the app's root is this directory.
  turbopack: { root: import.meta.dirname },
};

export default config;
