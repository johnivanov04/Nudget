/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
  // Backend-foundation phase: the app is API-first. UI surfaces (admin dashboard)
  // are added in a later phase. Keep config minimal and explicit.
  poweredByHeader: false,
};

export default nextConfig;
