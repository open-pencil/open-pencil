import { resolve, dirname } from "node:path";
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";

const __dirname = dirname(fileURLToPath(import.meta.url));
const CONFIG_PATH = resolve(__dirname, "..", "webreel.config.json");

const config = JSON.parse(readFileSync(CONFIG_PATH, "utf-8"));
const names = Object.keys(config.videos ?? {});

if (names.length === 0) {
  console.log("No videos defined in webreel.config.json");
} else {
  console.log(`Available demos (${names.length}):\n`);
  for (const name of names) {
    const video = config.videos[name];
    const url = video.url ?? "";
    const steps = video.steps?.length ?? 0;
    const output = video.output ?? `${name}.webm`;
    console.log(`  ${name}  →  ${output}  (${steps} steps, ${url})`);
  }
}
