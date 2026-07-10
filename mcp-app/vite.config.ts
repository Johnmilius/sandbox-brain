import react from "@vitejs/plugin-react";
import { skybridge } from "skybridge/vite";
import { defineConfig } from "vite";

export default defineConfig({
  plugins: [skybridge(), react()],
  build: {
    // Inline the bundled woff2 fonts as data URIs: Skybridge rewrites asset
    // URLs to a runtime expression (window.skybridge.serverUrl + ...), which
    // Vite does not support for assets referenced from CSS files. Everything
    // else keeps Vite's default inlining behavior (undefined = default).
    assetsInlineLimit: (filePath) =>
      filePath.endsWith(".woff2") ? true : undefined,
  },
});
