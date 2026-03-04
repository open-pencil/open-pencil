import { describe, expect, test } from "bun:test";
import { join } from "path";
import { readFileSync } from "fs";

const DEMOS_DIR = join(import.meta.dir, "../../packages/demos");
const CONFIG_PATH = join(DEMOS_DIR, "webreel.config.json");
const LIST_SCRIPT = join(DEMOS_DIR, "scripts/list.ts");

function parseConfig() {
  return JSON.parse(readFileSync(CONFIG_PATH, "utf-8"));
}

describe("webreel config", () => {
  test("valid JSON with required fields", () => {
    const config = parseConfig();
    expect(config.$schema).toBeString();
    expect(config.videos).toBeObject();
    expect(Object.keys(config.videos).length).toBeGreaterThan(0);
  });

  test("every video has url and steps", () => {
    const config = parseConfig();
    for (const video of Object.values<Record<string, unknown>>(config.videos)) {
      expect(video.url).toBeString();
      expect(video.steps).toBeArray();
      expect((video.steps as unknown[]).length).toBeGreaterThan(0);
    }
  });

  test("all steps use data-test-id selectors", () => {
    const config = parseConfig();
    for (const video of Object.values<Record<string, unknown>>(config.videos)) {
      for (const step of video.steps as Record<string, unknown>[]) {
        if (step.selector) {
          expect(step.selector as string).toContain("data-test-id");
        }
      }
    }
  });

  test("toolbar video outputs webm", () => {
    const config = parseConfig();
    expect(config.videos.toolbar).toBeDefined();
    expect(config.videos.toolbar.output).toEndWith(".webm");
  });
});

describe("demo:list", () => {
  test("lists available demos", async () => {
    const proc = Bun.spawn(["bun", LIST_SCRIPT], {
      stdout: "pipe",
      stderr: "pipe",
    });
    const stdout = await new Response(proc.stdout).text();
    const exitCode = await proc.exited;
    expect(exitCode).toBe(0);
    expect(stdout).toContain("toolbar");
    expect(stdout).toContain("toolbar.webm");
  });
});
