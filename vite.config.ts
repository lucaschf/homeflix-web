// ``vitest/config`` re-exports Vite's own ``defineConfig`` plus the
// ``test`` block, so the suite runs through the same plugin pipeline
// (JSX, path handling) the app is built with.
import { defineConfig } from "vitest/config";
import react from "@vitejs/plugin-react";

export default defineConfig({
  plugins: [react()],
  test: {
    // Components under test render into a DOM; the pure state machines
    // don't care either way.
    environment: "jsdom",
    setupFiles: ["./src/test/setup.ts"],
    // Explicit imports over ambient globals, so a test file reads the
    // same as any other module in ``src``.
    globals: false,
  },
  server: {
    port: 3000,
    // Bind to all interfaces so the dev server is reachable over the
    // Tailscale network (not just localhost) — lets remote devices on
    // the tailnet open the app at http://<tailscale-ip>:3000.
    host: true,
    // Vite 8 blocks requests whose Host header is an unknown hostname.
    // Allow the Tailscale MagicDNS names for this machine so the app
    // works when opened by name instead of by IP:
    //   - ".ts.net"  → the fully-qualified name (homeflix.tailXXXX.ts.net)
    //   - "homeflix" → the short MagicDNS name (http://homeflix:3000)
    // Raw IPs are already permitted by default.
    allowedHosts: [".ts.net", "homeflix"],
    proxy: {
      "/api": {
        target: "http://localhost:8005",
        changeOrigin: true,
      },
      "/health": {
        target: "http://localhost:8005",
        changeOrigin: true,
      },
    },
  },
});
