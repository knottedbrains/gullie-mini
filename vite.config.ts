import { fileURLToPath, URL } from 'node:url'

import { defineConfig } from "vite"
import react from "@vitejs/plugin-react"

export default defineConfig({
  resolve: {
    alias: {
      '@': fileURLToPath(new URL('./src', import.meta.url)),
    },
  },
  plugins: [react()],
  server: {
    port: 5173, // 🔒 lock frontend to 5173
    proxy: {
      "/api": {
        target: "http://localhost:4000", // backend
        changeOrigin: true,
      },
    },
  },
})
