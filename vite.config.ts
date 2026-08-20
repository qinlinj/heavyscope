import { readFileSync } from "node:fs";
import path from "node:path";
import tailwindcss from "@tailwindcss/vite";
import react from "@vitejs/plugin-react";
import { defineConfig } from "vitest/config";

const pkg = JSON.parse(
  readFileSync(path.resolve(import.meta.dirname, "package.json"), "utf8"),
) as { version: string };

function headerValue(value: string | string[] | undefined): string | undefined {
  if (Array.isArray(value)) return value[0];
  return value;
}

export default defineConfig({
  plugins: [react(), tailwindcss()],
  resolve: {
    alias: {
      "@": path.resolve(import.meta.dirname, "./src"),
    },
  },
  server: {
    watch: {
      ignored: ["**/src-tauri/**"],
    },
    proxy: {
      "/proxy/cursor": {
        target: "https://cursor.com",
        changeOrigin: true,
        secure: true,
        rewrite: (path) => path.replace(/^\/proxy\/cursor/, ""),
        configure: (proxy) => {
          proxy.on("proxyReq", (proxyReq, req) => {
            const cookie = headerValue(req.headers["x-heavyscope-cookie"]);
            if (cookie) proxyReq.setHeader("Cookie", cookie);
            proxyReq.setHeader(
              "User-Agent",
              "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0.0.0 Safari/537.36",
            );
            proxyReq.removeHeader("x-heavyscope-cookie");
            proxyReq.removeHeader("x-heavyscope-authorization");
          });
        },
      },
      "/proxy/grok-cli": {
        target: "https://cli-chat-proxy.grok.com",
        changeOrigin: true,
        secure: true,
        rewrite: (path) => path.replace(/^\/proxy\/grok-cli/, ""),
        configure: (proxy) => {
          proxy.on("proxyReq", (proxyReq, req) => {
            const cookie = headerValue(req.headers["x-heavyscope-cookie"]);
            const authorization = headerValue(req.headers["x-heavyscope-authorization"]);
            if (cookie) proxyReq.setHeader("Cookie", cookie);
            if (authorization) proxyReq.setHeader("Authorization", authorization);
            proxyReq.setHeader(
              "User-Agent",
              "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0.0.0 Safari/537.36",
            );
            proxyReq.removeHeader("x-heavyscope-cookie");
            proxyReq.removeHeader("x-heavyscope-authorization");
          });
        },
      },
      "/proxy/grok": {
        target: "https://grok.com",
        changeOrigin: true,
        secure: true,
        rewrite: (path) => path.replace(/^\/proxy\/grok/, ""),
        configure: (proxy) => {
          proxy.on("proxyReq", (proxyReq, req) => {
            const cookie = headerValue(req.headers["x-heavyscope-cookie"]);
            const authorization = headerValue(req.headers["x-heavyscope-authorization"]);
            if (cookie) proxyReq.setHeader("Cookie", cookie);
            if (authorization) proxyReq.setHeader("Authorization", authorization);
            proxyReq.setHeader("Origin", "https://grok.com");
            proxyReq.setHeader("Referer", "https://grok.com/");
            proxyReq.setHeader(
              "User-Agent",
              "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0.0.0 Safari/537.36",
            );
            proxyReq.removeHeader("x-heavyscope-cookie");
            proxyReq.removeHeader("x-heavyscope-authorization");
          });
        },
      },
    },
  },
  optimizeDeps: {
    include: ["sql.js"],
  },
  define: {
    __APP_VERSION__: JSON.stringify(pkg.version),
  },
  test: {
    environment: "node",
    include: ["src/**/*.test.ts"],
  },
});
