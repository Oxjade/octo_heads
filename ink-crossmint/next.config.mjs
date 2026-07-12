/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
  // The Ika SDK loads its Node WASM binary from disk at runtime. Keep the
  // package external so its JS glue retains the correct __dirname, and make
  // Next's file tracer include the binary in the Vercel function bundle.
  serverExternalPackages: ["@ika.xyz/ika-wasm"],
  outputFileTracingIncludes: {
    "/api/mint/ika": ["./node_modules/@ika.xyz/ika-wasm/dist/node/**/*"],
  },
};

export default nextConfig;
