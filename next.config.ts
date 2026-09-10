import type { NextConfig } from "next";

const config: NextConfig = {
  output: "export",
  basePath: "/otsukare",
  images: { unoptimized: true },
};

export default config;
