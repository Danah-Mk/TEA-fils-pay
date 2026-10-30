import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";

export default defineConfig({
  plugins: [react()],
  // Same-origin /v1 via this proxy: cookies are Path=/ on :5173, so login
  // works without cross-port CORS. Direct http://localhost:3000 from the
  // browser would drop SameSite=Lax session cookies.
  server: {
    port: 5173,
    proxy: {
      "/v1": "http://127.0.0.1:3000",
      "/healthz": "http://127.0.0.1:3000",
      "/readyz": "http://127.0.0.1:3000",
    },
  },
});
