// Renders the README diagrams with Excalidraw's own exporter (pinned @excalidraw/excalidraw 0.18.0).
// Usage: node render.mjs [name ...]
// Env: PUPPETEER_DIR (folder with node_modules/puppeteer-core), CHROME (path to Chrome).
import http from "node:http";
import { readFile, writeFile } from "node:fs/promises";
import { createRequire } from "node:module";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { scenes } from "./scenes.mjs";

const here = path.dirname(fileURLToPath(import.meta.url));
const outDir = path.resolve(here, "..");
const require = createRequire(path.join(process.env.PUPPETEER_DIR || process.cwd(), "package.json"));
const puppeteer = require("puppeteer-core");
const CHROME = process.env.CHROME || "C:/Program Files/Google/Chrome/Application/chrome.exe";

const page = await readFile(path.join(here, "index.html"));
const server = http.createServer((req, res) => {
  res.writeHead(200, { "Content-Type": "text/html; charset=utf-8" });
  res.end(page);
});
await new Promise((r) => server.listen(0, "127.0.0.1", r));
const url = `http://127.0.0.1:${server.address().port}/`;

const browser = await puppeteer.launch({ executablePath: CHROME, headless: true, args: ["--no-sandbox"] });
try {
  const tab = await browser.newPage();
  tab.on("console", (m) => process.stdout.write(`[page] ${m.text()}\n`));
  tab.on("pageerror", (e) => process.stdout.write(`[pageerror] ${e.message}\n`));
  await tab.goto(url, { waitUntil: "load" });
  await tab.waitForFunction("window.__ready === true", { timeout: 120_000 });
  const want = process.argv.slice(2);
  for (const [name, build] of Object.entries(scenes)) {
    if (want.length && !want.includes(name)) continue;
    const skeleton = build();
    const out = await tab.evaluate((s) => window.renderScene(s, 40, 2), skeleton);
    await writeFile(path.join(outDir, `${name}.excalidraw`), out.json);
    await writeFile(path.join(outDir, `${name}.svg`), out.svg);
    await writeFile(path.join(outDir, `${name}.png`), Buffer.from(out.png, "base64"));
    console.log(`${name}: ${skeleton.length} elements, svg ${(out.svg.length / 1024).toFixed(0)} KB`);
  }
} finally {
  await browser.close();
  server.close();
}
