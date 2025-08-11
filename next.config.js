/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
  swcMinify: true,
  
  // Environment variables that should be available to the client
  env: {
    CUSTOM_KEY: process.env.CUSTOM_KEY,
  },

  // Headers for security
  async headers() {
    return [
      {
        source: '/(.*)',
        headers: [
          {
            key: 'X-Frame-Options',
            value: 'DENY',
          },
          {
            key: 'X-Content-Type-Options',
            value: 'nosniff',
          },
          {
            key: 'Referrer-Policy',
            value: 'origin-when-cross-origin',
          },
        ],
      },
    ];
  },

  // Rewrites for API routes if needed
  async rewrites() {
    return [
      {
        source: '/api/:path*',
        destination: '/api/:path*',
      },
    ];
  },

  // Experimental features
  experimental: {
    // Enable if you want to use server actions
    serverActions: true,
    // Enable if you want to use optimized package imports
    optimizePackageImports: ['axios', '@supabase/supabase-js'],
  },

  // Images configuration
  images: {
    domains: ['localhost'],
    formats: ['image/webp', 'image/avif'],
  },

  // Compression
  compress: true,

  // Powered by header
  poweredByHeader: false,

  // Generate ETags
  generateEtags: false,

  // Generate build ID
  generateBuildId: async () => {
    return 'survey-app-build';
  },

  // Disable source maps in production
  productionBrowserSourceMaps: false,

  // Static page generation
  trailingSlash: false,

  // Export configuration (if needed for static export)
  // output: 'export',
  // images: {
  //   unoptimized: true,
  // },
};

module.exports = nextConfig;
