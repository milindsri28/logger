const path = require('path');

/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
  outputFileTracingRoot: path.join(__dirname),
  // Next 15.5 enables segment explorer devtools by default; on Windows/HMR this can
  // corrupt the React Client Manifest (SegmentViewNode / __webpack_modules__ errors).
  experimental: {
    devtoolSegmentExplorer: false,
  },
};

module.exports = nextConfig;
