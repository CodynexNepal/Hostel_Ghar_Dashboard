/** @type {import('next').NextConfig} */
const nextConfig = {
  output: "standalone",
  reactStrictMode: true,
  poweredByHeader: false,
  images: {
    // Cloudinary hosts all uploaded images (platform checkout QRs, hostel
    // logos, owner avatars, payment QR codes). `next/image` throws
    // "next-image-unconfigured-host" for any remote src unless the delivery
    // host is allowlisted here. Cloudinary URLs look like:
    //   https://res.cloudinary.com/<cloud>/image/upload/…
    remotePatterns: [
      {
        protocol: "https",
        hostname: "res.cloudinary.com",
        // Host is already locked to Cloudinary's delivery CDN, so allow any
        // cloud name + delivery path (e.g. /<cloud>/image/upload/v123/…).
        pathname: "/**",
      },
    ],
  },
  async redirects() {
    return [
      {
        source: "/register",
        destination: "/login",
        permanent: false,
      },
    ];
  },
  async rewrites() {
    const backendApiUrl = process.env.NEXT_BACKEND_API_URL ?? "https://api.hostelghar.com/api";

    return [
      {
        source: "/api/:path*",
        destination: `${backendApiUrl}/:path*`,
      },
    ];
  },
};

export default nextConfig;
