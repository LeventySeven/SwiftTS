import { defineConfig } from "tsup";

/**
 * Library build. `bundle: false` transpiles each source file to its own ESM
 * module under dist/, which:
 *   - preserves every "use client" directive in place (RSC boundary intact),
 *   - keeps the relative `import "./x.module.css"` / `"./x.global.css"`
 *     statements so the consumer's bundler (Next.js, Vite, …) loads them,
 *   - mirrors the src/ tree so types (emitted separately by tsc) line up.
 * CSS files are copied verbatim by scripts/copy-css.mjs.
 */
export default defineConfig({
  entry: ["src/**/*.{ts,tsx}"],
  outDir: "dist",
  format: ["esm"],
  target: "es2022",
  bundle: false,
  splitting: false,
  sourcemap: false,
  clean: true,
  dts: false, // emitted by `tsc -p tsconfig.build.json` (reliable for 100+ files)
  esbuildOptions(options) {
    options.jsx = "automatic";
    options.jsxImportSource = "react";
  },
});
