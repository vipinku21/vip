import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
export default defineConfig({
  plugins: [
    react(),
    {
      name: "isolate-learner-worker",
      configureServer(server) {
        server.middlewares.use((req, res, next) => {
          if (req.url === "/runner.js") {
            const runtime = "http://" + req.headers.host + "/runtime/";
            res.setHeader(
              "Content-Security-Policy",
              "default-src 'none'; script-src " +
                runtime +
                " 'unsafe-eval' 'wasm-unsafe-eval'; connect-src " +
                runtime +
                "; worker-src 'none'",
            );
          }
          next();
        });
      },
    },
  ],
  server: {
    port: 5173,
    strictPort: true,
    proxy: { "/api": process.env.LAB_BACKEND || "http://127.0.0.1:8000" },
  },
  build: { chunkSizeWarningLimit: 2600 },
});
