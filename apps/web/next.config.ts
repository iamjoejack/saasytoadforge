import type { NextConfig } from 'next'

const config: NextConfig = {
  reactStrictMode: true,
  // Consume the shared workspace package from source.
  transpilePackages: ['@forge/shared'],
  // Linting is centralized at the repo root (eslint .); skip Next's build-time lint.
  eslint: { ignoreDuringBuilds: true },
  // Keep type errors failing the build.
  typescript: { ignoreBuildErrors: false },
}

export default config
