import { defineConfig } from "vitest/config";
import { fileURLToPath } from "node:url";

export default defineConfig({
  resolve: {
    alias: {
      "@capacitor-community/sqlite": fileURLToPath(
        new URL("./capacitor-shim.js", import.meta.url),
      ),
    },
  },
});
