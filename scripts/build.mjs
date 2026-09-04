import { createWriteStream, existsSync } from "node:fs";
import { cp, mkdir, readFile, readdir, rm, stat, writeFile } from "node:fs/promises";
import { dirname, join, relative, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import archiver from "archiver";

const root = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const dist = join(root, "dist");
const release = join(root, "release");
const clientId = process.env.THOUGHTLOGGER_OAUTH_CLIENT_ID?.trim() || null;
const include = ["manifest.json", "config.js", "background", "content", "lib", "popup", "welcome", "icons", "fonts"];

await rm(dist, { recursive: true, force: true });
await mkdir(dist, { recursive: true });
for (const item of include) {
  const source = join(root, item);
  if (!existsSync(source)) throw new Error(`Missing required extension asset: ${item}`);
  await cp(source, join(dist, item), { recursive: true });
}
const configPath = join(dist, "config.js");
const sourceConfig = await readFile(configPath, "utf8");
const config = clientId
  ? sourceConfig.replace(/oauthClientId:\s*"[^"]+"/, `oauthClientId: "${clientId}"`)
  : sourceConfig;
await writeFile(configPath, config);

async function walk(directory) {
  const files = [];
  for (const entry of await readdir(directory)) {
    const path = join(directory, entry); const info = await stat(path);
    if (info.isDirectory()) files.push(...await walk(path)); else files.push(path);
  }
  return files;
}
for (const file of await walk(dist)) {
  if (!/\.(?:js|html|css|json)$/.test(file)) continue;
  const source = await readFile(file, "utf8");
  if (/<script[^>]+src=["']https?:/i.test(source) || /\b(?:eval|new Function)\s*\(/.test(source)) {
    throw new Error(`Remote or dynamic executable code found in ${relative(root, file)}`);
  }
}
console.log(`Built ${relative(root, dist)}${clientId ? " with the supplied production OAuth client ID" : " with the development OAuth client ID"}.`);

if (process.argv.includes("--zip")) {
  await rm(release, { recursive: true, force: true }); await mkdir(release, { recursive: true });
  const manifest = JSON.parse(await readFile(join(root, "manifest.json"), "utf8"));
  const zipPath = join(release, `thoughtlogger-extension-${manifest.version}.zip`);
  await new Promise((resolvePromise, reject) => {
    const output = createWriteStream(zipPath); const archive = archiver("zip", { zlib: { level: 9 } });
    output.on("close", resolvePromise); output.on("error", reject); archive.on("error", reject);
    archive.pipe(output); archive.directory(dist, false); archive.finalize();
  });
  console.log(`Packaged ${relative(root, zipPath)}.`);
}
