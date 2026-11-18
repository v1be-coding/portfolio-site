import react from "@vitejs/plugin-react";
import { defineConfig } from "vite";

// Two builds share this config: the client bundle (dist/web, which is deployed)
// and, with --ssr, the prerender script that writes each page's HTML into it.
export default defineConfig(({ isSsrBuild }) => ({
  root: "src/web",
  plugins: [react()],
  build: {
    // Every asset is a real file: the CSP has no data: source (spec #2, Build).
    assetsInlineLimit: 0,
    ...(isSsrBuild
      ? { outDir: "../../dist/prerender", emptyOutDir: true, copyPublicDir: false }
      : { outDir: "../../dist/web", emptyOutDir: true }),
  },
}));
