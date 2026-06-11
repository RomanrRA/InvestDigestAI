import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // standalone: самодостаточный server.js для Docker-образа без node_modules
  output: "standalone",
};

export default nextConfig;
