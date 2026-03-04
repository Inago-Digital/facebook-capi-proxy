import { defineConfig } from "vite"
import react from "@vitejs/plugin-react"

export default defineConfig({
  plugins: [react()],
  build: {
    outDir: "_site/assets",
    emptyOutDir: false,
    rollupOptions: {
      input: "src/client.tsx",
      output: {
        entryFileNames: "client.min.js",
      },
    },
  },
  css: {
    postcss: {
      plugins: [],
    },
  },
})
