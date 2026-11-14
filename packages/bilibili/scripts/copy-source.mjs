import { cpSync, statSync } from "node:fs";

const sourceDir = new URL("../src/", import.meta.url);
const outputDir = new URL("../dist/", import.meta.url);
const extensions = [".js", ".d.ts"];

cpSync(sourceDir, outputDir, {
  recursive: true,
  filter: (source) =>
    statSync(source).isDirectory() ||
    extensions.some((extension) => source.endsWith(extension)),
});
