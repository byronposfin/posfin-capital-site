import tailwindcss from "@tailwindcss/vite";
import react from "@vitejs/plugin-react";
import path from "node:path";
import { defineConfig } from "vite";

const here = import.meta.dirname;

export default defineConfig({
  root: path.resolve(here, "client"),
  base: "/smartlink/static/",
  plugins: [react(), tailwindcss()],
  resolve: { alias: { "@": path.resolve(here) } },
  build: {
    outDir: path.resolve(here, "static"),
    emptyOutDir: true,
    assetsDir: "assets",
  },
});
