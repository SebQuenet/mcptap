import react from "@vitejs/plugin-react";
import { defineConfig } from "vite";

// Built with `vite build viewer` (root = this dir). Output goes to ../dist-viewer,
// which `mcptap view` serves. Kept out of the project root so it never overrides
// vitest's config discovery.
export default defineConfig({
  plugins: [react()],
  build: {
    outDir: "../dist-viewer",
    emptyOutDir: true,
  },
});
