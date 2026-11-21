/**
 * Builds the SmartLink UI and the /api/forms function into the static site.
 * This repo deploys the repository root with no Vercel build command: a root
 * "build" script would make Vercel publish only public/ and drop the HTML pages.
 * Run `npm run build:site` inside smartlink/ and commit the output.
 */
import * as esbuild from "esbuild";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { build } from "vite";

const smartlink = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const repo = path.resolve(smartlink, "..");

await esbuild.build({
  entryPoints: [path.join(smartlink, "server/vercel.ts")],
  outfile: path.join(repo, "api/smartlink-forms.js"),
  bundle: true,
  platform: "node",
  format: "esm",
  target: "node24",
  packages: "external",
  alias: { "@": smartlink },
  banner: {
    js: "/* Generated from smartlink/server/vercel.ts by smartlink/scripts/build-site.mjs. Do not edit. */",
  },
});

await build({ configFile: path.join(smartlink, "vite.config.ts") });
