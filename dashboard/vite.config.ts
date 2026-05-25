import path from "node:path";
import { fileURLToPath } from "node:url";
import react from "@vitejs/plugin-react";
import { defineConfig } from "vite";

const dir = path.dirname(fileURLToPath(import.meta.url));

function dashboardTrailingSlashPlugin() {
  return {
    name: "dashboard-trailing-slash",
    configureServer(server: import("vite").ViteDevServer) {
      server.middlewares.use((req, res, next) => {
        const url = req.url?.split("?")[0] ?? "";
        if (url === "/dashboard") {
          const q = req.url?.includes("?") ? req.url.slice(req.url.indexOf("?")) : "";
          res.writeHead(301, { Location: `/dashboard/${q}` });
          res.end();
          return;
        }
        next();
      });
    },
  };
}

export default defineConfig({
  root: dir,
  plugins: [react(), dashboardTrailingSlashPlugin()],
  base: "/dashboard/",
  server: {
    host: "127.0.0.1",
    port: 3000,
  },
  preview: {
    host: "127.0.0.1",
    port: 3000,
  },
  build: {
    outDir: path.join(dir, "dist"),
    emptyOutDir: true,
  },
});
