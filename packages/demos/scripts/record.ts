import { resolve, dirname } from "node:path";
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";

const __dirname = dirname(fileURLToPath(import.meta.url));
const DEMOS_DIR = resolve(__dirname, "..");
const CONFIG_PATH = resolve(DEMOS_DIR, "webreel.config.json");

async function resolveWebreelBin(): Promise<string> {
  const local = resolve(DEMOS_DIR, "node_modules/.bin/webreel");
  if (await Bun.file(local).exists()) return local;
  return resolve(DEMOS_DIR, "../../node_modules/.bin/webreel");
}

function readBaseUrl(): string {
  try {
    const config = JSON.parse(readFileSync(CONFIG_PATH, "utf-8"));
    return config.baseUrl ?? "http://localhost:1420";
  } catch {
    return "http://localhost:1420";
  }
}

async function checkDevServer(url: string): Promise<boolean> {
  try {
    await fetch(url, { signal: AbortSignal.timeout(3000) });
    return true;
  } catch {
    return false;
  }
}

interface ParsedArgs {
  scenario?: string;
  verbose: boolean;
  watch: boolean;
  preview: boolean;
}

function parseArgs(): ParsedArgs {
  const args = Bun.argv.slice(2);
  const flags: ParsedArgs = { verbose: false, watch: false, preview: false };

  for (let i = 0; i < args.length; i++) {
    const arg = args[i];
    if (arg === "--scenario" && i + 1 < args.length) {
      flags.scenario = args[++i];
    } else if (arg === "--verbose") {
      flags.verbose = true;
    } else if (arg === "--watch") {
      flags.watch = true;
    } else if (arg === "--preview") {
      flags.preview = true;
    }
  }

  return flags;
}

const { scenario, verbose, watch, preview } = parseArgs();
const baseUrl = readBaseUrl();

const serverUp = await checkDevServer(baseUrl);
if (!serverUp) {
  console.error(`Dev server not reachable at ${baseUrl}\nStart it first: bun run dev`);
  process.exit(1);
}

const bin = await resolveWebreelBin();
const command = preview ? "preview" : "record";
const cmd = [bin, command];
if (scenario) cmd.push(scenario);
cmd.push("-c", CONFIG_PATH);
if (verbose) cmd.push("--verbose");
if (watch && !preview) cmd.push("--watch");

const proc = Bun.spawn(cmd, {
  cwd: DEMOS_DIR,
  stdio: ["inherit", "inherit", "inherit"],
});

const exitCode = await proc.exited;
if (exitCode !== 0) {
  console.error(`\nwebreel exited with code ${exitCode}`);
  process.exit(exitCode);
}
