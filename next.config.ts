import type { NextConfig } from "next"

const nextConfig: NextConfig = {
  devIndicators: false,
  // Libera o túnel temporário da Cloudflare para ver o protótipo em outro aparelho.
  allowedDevOrigins: ["*.trycloudflare.com"],
}

export default nextConfig
