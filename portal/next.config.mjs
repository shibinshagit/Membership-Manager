/** @type {import('next').NextConfig} */
const nextConfig = {
  // Required for the Electron desktop package (see ../desktop).
  output: 'standalone',
  // Allow a second `next dev` (desktop) alongside web by setting NEXT_DIST_DIR.
  distDir: process.env.NEXT_DIST_DIR || '.next',
  serverExternalPackages: ['pg', 'pg-native', '@electric-sql/pglite'],
  // Keep desktop packages small — never ship SQL/blob backups inside standalone.
  outputFileTracingExcludes: {
    '*': [
      './blob-backup-*/**',
      './blob-backup-*.zip',
      './db-backup-*.sql',
      './data/**',
      './prisma/**',
      './**/*.md',
      './Untitled',
    ],
  },
  typescript: {
    ignoreBuildErrors: true,
  },
  images: {
    unoptimized: true,
  },
}

export default nextConfig
