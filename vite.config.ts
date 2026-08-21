import { readFileSync } from "node:fs";
import type { IncomingMessage } from "node:http";
import path from "node:path";
import tailwindcss from "@tailwindcss/vite";
import react from "@vitejs/plugin-react";
import type { Connect, ProxyOptions } from "vite";
import { defineConfig } from "vitest/config";

const pkg = JSON.parse(
  readFileSync(path.resolve(import.meta.dirname, "package.json"), "utf8"),
) as { version: string };

const BROWSER_UA =
  "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0.0.0 Safari/537.36";

function headerValue(value: string | string[] | undefined): string | undefined {
  if (Array.isArray(value)) return value[0];
  return value;
}

function markProxyResponse(proxyRes: IncomingMessage): void {
  proxyRes.headers["x-heavyscope-proxy"] = "1";
  proxyRes.headers["cache-control"] = "no-store";
}

function applyForwardedAuth(proxyReq: { setHeader: (k: string, v: string) => void; removeHeader: (k: string) => void }, req: IncomingMessage): void {
  const cookie = headerValue(req.headers["x-heavyscope-cookie"]);
  const authorization = headerValue(req.headers["x-heavyscope-authorization"]);
  if (cookie) proxyReq.setHeader("Cookie", cookie);
  if (authorization) proxyReq.setHeader("Authorization", authorization);
  proxyReq.setHeader("User-Agent", BROWSER_UA);
  proxyReq.removeHeader("x-heavyscope-cookie");
  proxyReq.removeHeader("x-heavyscope-authorization");
}

function liveProxy(target: string, rewritePrefix: string, extras?: (proxyReq: { setHeader: (k: string, v: string) => void }) => void): ProxyOptions {
  return {
    target,
    changeOrigin: true,
    secure: true,
    rewrite: (value) => value.replace(new RegExp(`^${rewritePrefix}`), ""),
    configure: (proxy) => {
      proxy.on("proxyReq", (proxyReq, req) => {
        applyForwardedAuth(proxyReq, req);
        extras?.(proxyReq);
      });
      proxy.on("proxyRes", (proxyRes) => {
        markProxyResponse(proxyRes);
      });
    },
  };
}

const liveProxies: Record<string, ProxyOptions> = {
  "/proxy/cursor": liveProxy("https://cursor.com", "/proxy/cursor", (proxyReq) => {
    proxyReq.setHeader("Origin", "https://cursor.com");
    proxyReq.setHeader("Referer", "https://cursor.com/dashboard/spending");
  }),
  "/proxy/grok-cli": liveProxy("https://cli-chat-proxy.grok.com", "/proxy/grok-cli"),
  "/proxy/grok": liveProxy("https://grok.com", "/proxy/grok", (proxyReq) => {
    proxyReq.setHeader("Origin", "https://grok.com");
    proxyReq.setHeader("Referer", "https://grok.com/");
  }),
};

function heavyscopeProxyProbe() {
  const handle: Connect.NextHandleFunction = (req, res, next) => {
    const url = req.url ?? "";
    if (
      url.startsWith("/proxy/cursor/__heavyscope_ok") ||
      url.startsWith("/proxy/grok/__heavyscope_ok") ||
      url.startsWith("/proxy/grok-cli/__heavyscope_ok")
    ) {
      res.statusCode = 204;
      res.setHeader("X-HeavyScope-Proxy", "1");
      res.setHeader("Cache-Control", "no-store");
      res.end();
      return;
    }
    next();
  };
  return {
    name: "heavyscope-proxy-probe",
    configureServer(server: { middlewares: { use: (fn: Connect.NextHandleFunction) => void } }) {
      server.middlewares.use(handle);
    },
    configurePreviewServer(server: { middlewares: { use: (fn: Connect.NextHandleFunction) => void } }) {
      server.middlewares.use(handle);
    },
  };
}

export default defineConfig({
  plugins: [react(), tailwindcss(), heavyscopeProxyProbe()],
  resolve: {
    alias: {
      "@": path.resolve(import.meta.dirname, "./src"),
    },
  },
  server: {
    watch: {
      ignored: ["**/src-tauri/**"],
    },
    proxy: liveProxies,
  },
  preview: {
    proxy: liveProxies,
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
