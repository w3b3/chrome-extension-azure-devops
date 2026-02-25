import * as esbuild from "esbuild";
import { cpSync, existsSync, mkdirSync } from "fs";

const watch = process.argv.includes("--watch");

const commonOptions = {
  bundle: true,
  sourcemap: true,
  target: "chrome120",
  format: "esm",
};

const builds = [
  {
    ...commonOptions,
    entryPoints: ["src/background/service-worker.ts"],
    outfile: "dist/background/service-worker.js",
  },
  {
    ...commonOptions,
    entryPoints: ["src/popup/popup.ts"],
    outfile: "dist/popup/popup.js",
  },
  {
    ...commonOptions,
    entryPoints: ["src/options/options.ts"],
    outfile: "dist/options/options.js",
  },
];

// Copy static files to dist
if (!existsSync("dist")) mkdirSync("dist", { recursive: true });
cpSync("static", "dist", { recursive: true });

// Copy HTML and CSS files alongside their JS bundles
for (const dir of ["popup", "options"]) {
  for (const ext of [".html", ".css"]) {
    const src = `src/${dir}/${dir}${ext}`;
    const dest = `dist/${dir}/${dir}${ext}`;
    if (existsSync(src)) cpSync(src, dest);
  }
}

if (watch) {
  for (const config of builds) {
    const ctx = await esbuild.context(config);
    await ctx.watch();
  }
  // eslint-disable-next-line no-console
  console.log("Watching for changes...");
} else {
  await Promise.all(builds.map((config) => esbuild.build(config)));
  // eslint-disable-next-line no-console
  console.log("Build complete.");
}
