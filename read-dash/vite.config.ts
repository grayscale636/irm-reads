import { defineConfig } from "vite";
import react from "@vitejs/plugin-react-swc";
import path from "path";
import { componentTagger } from "lovable-tagger";

// https://vitejs.dev/config/
export default defineConfig(({ mode }) => ({
  server: {
    host: "::",
    port: 8080,
    proxy: {
      '/minio-proxy': {
        target: 'https://minio.irmlabs.my.id:9000',
        changeOrigin: true,
        rewrite: (path) => path.replace(/^\/minio-proxy/, ''),
        secure: true,
      },
    },
  },
  preview: {
    host: "::",
    port: 8210,
    allowedHosts: ['reads.irmlabs.my.id', 'localhost', '192.168.100.220'],
  },
  plugins: [react(), mode === "development" && componentTagger()].filter(Boolean),
  resolve: {
    alias: {
      "@": path.resolve(__dirname, "./src"),
    },
  },
}));
