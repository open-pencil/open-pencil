---
title: Renderer Profiler
description: Use the CanvasKit renderer profiler HUD and frame capture tools to investigate rendering performance.
---

# Renderer Profiler

OpenPencil includes a CanvasKit renderer profiler for debugging frame time, GPU timing, draw calls, cache behavior, and expensive render phases.

## Enable the HUD

In the browser app, open the menu and choose:

```txt
View → Profiler
```

The app toggles `store.toggleProfiler()`, which maps to `editor.renderer.profiler.toggle()`.

The HUD is drawn directly on the Skia canvas so it measures the same rendering path as the document. It is not a DOM overlay.

## HUD metrics

The profiler HUD shows:

- **FPS / frame time** — smoothed frame cadence.
- **CPU** — JavaScript/WASM render time for the frame.
- **GPU** — latest available `EXT_disjoint_timer_query_webgl2` result when the browser exposes it.
- **Nodes / culled nodes** — total visible scene work and viewport culling count.
- **Draws** — WebGL draw calls counted through the instrumented context.
- **Cache** — whether the scene picture cache was reused.
- **Phases** — timings for renderer phases such as scene draw, picture replay/record, volatile overlays, section labels, selection, rulers, and flush.
- **Frame graph** — rolling frame history with 60 fps / 30 fps / slow thresholds and GPU bars when available.

GPU timing is asynchronous. The value shown is the latest completed GPU query, not necessarily the current frame.

## Implementation locations

Core profiler code lives in:

```txt
packages/core/src/profiler/
```

Main entry points:

- `render-profiler.ts` — `RenderProfiler` facade used by `SkiaRenderer`.
- `frame/stats.ts` — rolling frame statistics.
- `gpu-timer.ts` — WebGL timer query wrapper.
- `draw-call-counter.ts` — WebGL draw-call instrumentation.
- `phase-timer.ts` — phase timing and User Timing integration.
- `hud-renderer.ts` — canvas HUD rendering.
- `frame/capture.ts` and `speedscope-export.ts` — detailed capture and Speedscope export.

Renderer integration lives under:

```txt
packages/core/src/canvas/renderer*.ts
packages/core/src/canvas/renderer/
```

App wiring lives in:

```txt
src/app/editor/profiler/index.ts
src/app/shell/menu/schema.ts
src/app/shell/menu/app-menu.ts
```

## Programmatic use

From app/editor code:

```ts
store.toggleProfiler()
```

From a renderer instance:

```ts
renderer.profiler.toggle()
renderer.profiler.beginCapture()
// render one or more frames
const capture = renderer.profiler.endCapture()
const speedscopeJson = renderer.profiler.exportSpeedscope()
renderer.profiler.downloadSpeedscope()
```

Detailed captures are for targeted debugging. Keep the normal HUD path lightweight and avoid enabling expensive capture work unless a user or developer explicitly asks for it.

## Notes

- The profiler is designed to be safe when disabled: no timing calls or allocations should be added to hot paths unless `profiler.enabled` / `profiler.capturing` is active.
- GPU timing depends on browser and hardware support for `EXT_disjoint_timer_query_webgl2`.
- If GPU timing is unavailable, the HUD still reports CPU time, draw calls, phases, node counts, and cache status.
