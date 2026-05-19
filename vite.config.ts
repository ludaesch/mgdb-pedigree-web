import { defineConfig } from "vite";

// In production (GitHub Pages), the app lives at /<repo>/ so all asset URLs need
// that prefix. In dev, base is just /. import.meta.env.BASE_URL in source code
// reflects this automatically.
export default defineConfig(({ command }) => ({
  base: command === "build" ? "/mgdb-pedigree-web/" : "/",
  server: {
    port: 5173,
    open: false,
  },
  build: {
    outDir: "dist",
    target: "es2022",
    sourcemap: true,
  },
}));
