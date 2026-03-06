/** @type {import('next').NextConfig} */
const config = {
  reactStrictMode: true,
  output: "export",
  // Static export doesn't support image optimization — use unoptimized images
  images: { unoptimized: true },
}

export default config
