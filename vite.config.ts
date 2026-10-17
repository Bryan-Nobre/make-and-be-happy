import tailwindcss from "@tailwindcss/vite";
import { tanstackStart } from "@tanstack/react-start/plugin/vite";
import viteReact from "@vitejs/plugin-react";
import { nitro } from "nitro/vite";
import { defineConfig } from "vite";
import viteTsConfigPaths from "vite-tsconfig-paths";

export default defineConfig({
  server: {
    port: 3080,
    strictPort: true,
    host: true,
  },
  // O pré-empacotamento do Vite quebra a URL do .wasm do encoder WebP.
  optimizeDeps: { exclude: ["@jsquash/webp"] },
  plugins: [
    viteTsConfigPaths({ projects: ["./tsconfig.json"] }),
    tailwindcss(),
    tanstackStart({
      // Redireciona a entrada do servidor para src/server.ts
      server: { entry: "server" },
    }),
    nitro(),
    viteReact(),
  ],
});
