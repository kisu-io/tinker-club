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
};

module.exports = nextConfig;