import { build as esbuild } from "esbuild";
import { build as viteBuild } from "vite";
import { rm, readFile, copyFile } from "fs/promises";

// server deps to bundle to reduce openat(2) syscalls
// which helps cold start times
const allowlist = [
  "@google/generative-ai",
  "axios",
  "sql.js",
  "cors",
  "date-fns",
  "express",
  "express-rate-limit",
  "express-session",
  "jsonwebtoken",
  "memorystore",
  "multer",
  "nanoid",
  "nodemailer",
  "openai",
  "passport",
  "passport-local",
  "stripe",
  "uuid",
  "ws",
  "xlsx",
  "zod",
  "zod-validation-error",
];

async function buildAll() {
  await rm("dist", { recursive: true, force: true });

  console.log("building client...");
  await viteBuild();

  console.log("building electron processes...");
  const pkg = JSON.parse(await readFile("package.json", "utf-8"));
  const allDeps = [
    ...Object.keys(pkg.dependencies || {}),
    ...Object.keys(pkg.devDependencies || {}),
  ];
  const externals = allDeps.filter((dep) => !allowlist.includes(dep) && dep !== "electron");

  // Build Main Process
  await esbuild({
    entryPoints: ["electron/main.ts"],
    platform: "node",
    bundle: true,
    format: "cjs",
    outfile: "dist/main.cjs",
    define: {
      "process.env.NODE_ENV": '"production"',
    },
    minify: true,
    external: [...externals, "electron"],
    logLevel: "info",
  });

  // Build Preload Script
  await esbuild({
    entryPoints: ["electron/preload.ts"],
    platform: "node",
    bundle: true,
    format: "cjs",
    outfile: "dist/preload.cjs",  // MUST match package.json files[] and main.ts preload path
    minify: true,
    external: ["electron"],
    logLevel: "info",
  });

  console.log("copying sql-wasm.wasm...");
  await copyFile("node_modules/sql.js/dist/sql-wasm.wasm", "dist/sql-wasm.wasm");
}

buildAll().catch((err) => {
  console.error(err);
  process.exit(1);
});
