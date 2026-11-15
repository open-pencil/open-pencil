---
title: Page Memory
description: How to measure the editor page's memory in WebKit and Chromium, and how to find what keeps memory alive.
---

# Page Memory

The editor's memory lives in several places at once: the JavaScript heaps of the page and of the `.fig` session worker, WebAssembly memory for CanvasKit and Taffy, native allocations, and GPU memory, where the tile cache may grow up to the budget `viewportTileCacheBudget` sets (`packages/core/src/canvas/renderer/tiles/cache.ts`). A heap number from one engine's DevTools covers only part of it, so measure in the engine where the problem was reported, and compare runs only under the same window size and device pixel ratio.

## WebKit on macOS

On macOS the desktop app and Safari run the page in a WebContent process, and these tools are macOS ones. The Windows desktop app runs on WebView2, so measure it as Chromium.

- `footprint -p <WebContent pid>` works without root. "WebKit Malloc" is the JavaScriptCore heap with WebKit's own allocations, and "Owned physical footprint (graphics)" is the page's GPU memory.
- JavaScriptCore collects lazily, so most of a large "WebKit Malloc" right after a load can be garbage. `notifyutil -p org.WebKit.lowMemory` reaches the WebContent process and makes it collect and release memory; send it before every measurement.
- JavaScriptCore options can be set for WebContent through `__XPC_JSC_<option>` environment variables on the host process that embeds the web view.

## Chromium

- `Runtime.getHeapUsage` reports the main isolate only, without workers, WebAssembly, or GPU memory.
- For the whole split, start browser-level tracing over CDP with the `disabled-by-default-memory-infra` category and call `Tracing.requestMemoryDump`. The dump separates the main and worker V8 heaps, malloc, PartitionAlloc, and the GPU process.
- `Runtime.queryObjects` on `WebAssembly.Memory.prototype` crashes the renderer on this app; do not use it to count WebAssembly memory.

## Finding what keeps memory alive

When memory grows with use, such as undo steps that should have been trimmed:

1. Make the leak cheap to trigger. Lowering a limit in a scratch worktree, such as the undo history's, lets a few actions show what would otherwise take hundreds.
2. Record with the V8 sampling heap profiler to find which allocations keep growing.
3. Take one Chromium heap snapshot and follow the retainers of a leaked object. A shortest path shows only one holder, so after fixing it, exclude that edge and look again for the next one.

Headless Bun scripts see only what Core holds; holders in the app, such as closures kept by a Vue watcher, show up only in the page.
