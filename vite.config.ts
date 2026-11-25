import { defineConfig, type ProxyOptions } from "vite";
import react from "@vitejs/plugin-react";

// Proxy local : les appels partent du navigateur vers localhost, puis Vite les relaie
// au fournisseur. Ça évite les blocages CORS ; les clés ne transitent que par votre machine.
const upstreams: Record<string, string> = {
  "/api/anthropic": "https://api.anthropic.com",
  "/api/openai": "https://api.openai.com",
  "/api/gemini": "https://generativelanguage.googleapis.com",
  "/api/mistral": "https://api.mistral.ai",
  "/api/apify": "https://api.apify.com",
};

const proxy: Record<string, ProxyOptions> = Object.fromEntries(
  Object.entries(upstreams).map(([prefix, target]) => [
    prefix,
    {
      target,
      changeOrigin: true,
      secure: true,
      timeout: 330_000,
      proxyTimeout: 330_000,
      rewrite: (path: string) => path.slice(prefix.length),
      configure: (p) => {
        p.on("proxyReq", (req) => {
          req.removeHeader("origin");
          req.removeHeader("referer");
          req.removeHeader("cookie");
        });
      },
    } satisfies ProxyOptions,
  ]),
);

export default defineConfig({
  plugins: [react()],
  server: { port: 5173, proxy },
  preview: { port: 4173, proxy },
});
