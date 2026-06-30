/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
  amp: {
    canonicalBase: '',
  },
  typescript: {
    tsconfigPath: 'tsconfig.json',
    ignoreBuildErrors: false,
  },
}
module.exports = nextConfig
