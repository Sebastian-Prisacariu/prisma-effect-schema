import { defineConfig } from "tsup";

export default defineConfig({
  entry: {
    index: "src/index.ts",
    generator: "src/generator.ts",
    bin: "src/bin.ts",
  },
  format: ["esm"],
  dts: true,
  clean: true,
  sourcemap: true,
  target: "node18",
  shims: false,
});
