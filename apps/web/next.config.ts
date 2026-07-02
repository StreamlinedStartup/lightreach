import type { NextConfig } from "next"
import path from "path"

// next.config.ts is transpiled as CommonJS regardless of the package's
// "type": "module" (see Next's TypeScript config docs), so `__dirname` is
// available as a normal CJS global here — don't use `import.meta.url`.
const nextConfig: NextConfig = {
  output: "standalone",
  outputFileTracingRoot: path.join(__dirname, "../../"),
  transpilePackages: ["@workspace/ui", "@workspace/db", "@workspace/core"],
}

export default nextConfig
