/** @type {import('next').NextConfig} */
const nextConfig = {
  // Self-contained server bundle for the production Docker image (see Dockerfile).
  output: "standalone",
  // Defense in depth: next/image is not used today (VehicleImage renders a
  // plain <img>), but keep this narrow so a future switch to <Image> doesn't
  // accidentally turn the route into an SSRF proxy.
  // Add your production storage origin here when wiring real uploads.
  images: {
    remotePatterns: [
      { protocol: "https", hostname: "images.unsplash.com" },
    ],
  },
  // When serving over plain HTTP (no domain/HTTPS yet), Next's default CSP
  // includes `upgrade-insecure-requests` which makes the browser try HTTPS for
  // all subresources — and fail because there's no HTTPS listener. Disable the
  // strict CSP until we have a real domain + HTTPS via Caddy.
  async headers() {
    return [
      {
        source: "/(.*)",
        headers: [
          { key: "Content-Security-Policy", value: "" },
          { key: "Strict-Transport-Security", value: "" },
        ],
      },
    ];
  },
};

module.exports = nextConfig;