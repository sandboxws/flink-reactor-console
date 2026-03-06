/** @type {import('next').NextConfig} */
const config = {
  reactStrictMode: true,
  // Static export for production builds (Go server serves the static files).
  // Disabled in dev mode so dynamic routes like /jobs/[id] work without
  // pre-enumerating every possible param in generateStaticParams().
  ...(process.env.NODE_ENV === "production" && { output: "export" }),
  // Static export doesn't support image optimization — use unoptimized images
  images: { unoptimized: true },
}

export default config
