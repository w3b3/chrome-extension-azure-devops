import { cpSync, existsSync, mkdirSync, rmSync } from "fs";
import { resolve } from "path";
import { execFileSync } from "child_process";

const rootDir = process.cwd();
const distDir = resolve(rootDir, "dist");
const buildDir = resolve(rootDir, "EXTENSION_BUILD");
const zipPath = resolve(rootDir, "extension-upload.zip");

if (!existsSync(distDir)) {
  // eslint-disable-next-line no-console
  console.error("Missing dist/ folder. Run `npm run build` first.");
  process.exit(1);
}

if (existsSync(buildDir)) {
  rmSync(buildDir, { recursive: true, force: true });
}
mkdirSync(buildDir, { recursive: true });

cpSync(distDir, buildDir, { recursive: true });

if (existsSync(zipPath)) {
  rmSync(zipPath, { force: true });
}

try {
  // Zip contents of EXTENSION_BUILD so manifest.json is at ZIP root.
  execFileSync("zip", ["-r", zipPath, "."], {
    cwd: buildDir,
    stdio: "inherit",
  });
} catch (error) {
  // eslint-disable-next-line no-console
  console.error("Failed to create ZIP. Ensure `zip` is installed and available.");
  process.exit(1);
}

// eslint-disable-next-line no-console
console.log(`Prepared extension files in: ${buildDir}`);
// eslint-disable-next-line no-console
console.log(`Created upload archive at: ${zipPath}`);
// eslint-disable-next-line no-console
console.log("Next step: upload extension-upload.zip in Chrome Web Store dashboard.");
