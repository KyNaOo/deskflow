import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // Image de production : serveur Node autonome avec uniquement les fichiers utilisés
  output: "standalone",
};

export default nextConfig;
