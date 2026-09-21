/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
  // Enables src/instrumentation.ts (the in-process sync scheduler used on
  // Hostinger, which has no cron infra for Node.js Web Apps Hosting).
  // No-op on Next.js versions where this is already stable by default.
  experimental: {
    instrumentationHook: true,
  },
};

export default nextConfig;
