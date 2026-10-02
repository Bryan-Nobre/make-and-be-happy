import { defineConfig } from "@lovable.dev/vite-tanstack-config";

export default defineConfig({
  vite: {
    server: {
      port: 3080,
      strictPort: true,
      host: true,
    },
    // O pré-empacotamento do Vite quebra a URL do .wasm do encoder WebP.
    optimizeDeps: { exclude: ["@jsquash/webp"] },
  },

  tanstackStart: {
    // Redirect TanStack Start's bundled server entry to src/server.ts
    server: { entry: "server" },
  },
});
