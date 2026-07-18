/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
  // Backend-foundation phase: the app is API-first. UI surfaces (admin dashboard)
  // are added in a later phase. Keep config minimal and explicit.
  poweredByHeader: false,
  async headers() {
    return [
      {
        // Apple fetches this as JSON to validate the app<->domain association
        // used for Plaid OAuth universal links.
        source: '/.well-known/apple-app-site-association',
        headers: [{ key: 'Content-Type', value: 'application/json' }],
      },
    ];
  },
};

export default nextConfig;
