import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";

export default defineConfig({
  plugins: [react()],
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
