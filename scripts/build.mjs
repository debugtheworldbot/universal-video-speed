import { build as buildExtensionScripts } from "esbuild";
import { build as buildOptions } from "vite";

await buildOptions();

await buildExtensionScripts({
  entryPoints: {
    content: "src/content.ts"
  },
  bundle: true,
  format: "iife",
  target: "chrome120",
  outdir: "dist",
  entryNames: "[name]",
  sourcemap: false,
  minify: true
});
