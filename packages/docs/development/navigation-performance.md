# Navigation performance benchmark

The navigation benchmark measures the complete wheel/trackpad-to-render pipeline. It is intentionally separate from the synchronous microbenchmark in `tests/e2e/viewport/zoom-pan.spec.ts`: accepting JavaScript calls quickly does not prove smooth navigation.

## Renderer lifecycle and ownership

The benchmark validates the retained and tiled renderer contracts documented in [Renderer lifecycle and ownership](./renderer-lifecycle.md). Structural renderer changes must preserve those generation, settlement, and CanvasKit ownership rules.

## What it captures

Every run writes `recording.json`, `metrics.json`, and `environment.json`. When tracing is enabled, it also writes `trace.json.gz`:

- `trace.json.gz` (when tracing is enabled): Chromium tracing data for Perfetto or Chrome tracing tools.
- `recording.json`: wheel samples plus OpenPencil input, viewport, render, and retained-backing events.
- `metrics.json`: frame pacing, input latency, zoom-anchor drift, viewport jumps, exact active-renderer settlement, and tiled scheduler throughput/cancellation when enabled.
- `environment.json`: browser, runtime, replay mode, and source gesture information.

OpenPencil emits User Timing marks under `openpencil:*`, including wheel receipt/flush, viewport mutation, render start/end, backing preview/build, crisp-backing completion, and exact tiled coverage. The recording also runs a continuous `requestAnimationFrame` heartbeat and observes browser Long Tasks, so display stalls remain visible even when OpenPencil does not render.

## Record a physical macOS trackpad gesture

1. Start a production preview (preferred) or development server:

   ```sh
   bun run build
   bun run preview -- --port 1420
   ```

2. Open:

   ```text
   http://localhost:1420/?test&no-chrome&no-rulers&navigation-benchmark
   ```

3. In DevTools, start recording:

   ```js
   openPencil.test.navigation.startRecording('macbook-fast-pinch-reversal')
   ```

4. Perform exactly one gesture, allow the canvas to become crisp, then stop and copy the result:

   ```js
   copy(JSON.stringify(openPencil.test.navigation.stopRecording(), null, 2))
   ```

5. Save the result under `tests/fixtures/navigation/gestures/`. Do not edit delta values or timestamps. Remove document names if they contain private information.

Record at least slow pan, momentum pan, direction reversal, slow pinch, fast pinch in/out, pinch reversal, diagonal pan, and the personally observed failing gesture. Recordings from actual hardware must use `source: "macos-trackpad"`; generated fixtures use `source: "synthetic"`.

## Benchmark a real `.fig` fixture

Use `current-document` with an explicit browser-served fixture path. The runner waits for loading and page population, applies layout through the normal document-open path, zooms to fit, and waits on the active renderer's explicit settlement contract before recording:

```sh
bun run benchmark:navigation \
  --url http://localhost:1420/ \
  --gesture tests/fixtures/navigation/gestures/synthetic-pinch-reversal.json \
  --mode dom \
  --scenario current-document \
  --document tests/fixtures/gold-preview.fig \
  --no-trace \
  --output artifacts/navigation-benchmark/gold-preview
```

`environment.json` records the resolved local document path so reports cannot silently mix generated and real-document runs. The runner serves the exact local bytes through an isolated Playwright route, so production Vite preview does not return its SPA fallback for non-public test fixtures.

## Replay with Chromium tracing

```sh
bun run benchmark:navigation \
  --url http://localhost:1420/ \
  --gesture tests/fixtures/navigation/gestures/synthetic-pinch-reversal.json \
  --mode cdp \
  --scenario raster-stress \
  --output artifacts/navigation-benchmark/current
```

`--mode cdp` sends browser input through the Chrome DevTools Protocol. `--mode dom` deterministically dispatches events inside the page and is useful for scheduler/correctness debugging. Neither mode is represented as physical WKWebView input.

Use `--no-trace` for the lowest-overhead metrics pass. Run a separate diagnostic pass with tracing enabled, and add `--cpu-profile` only when stack sampling is needed: CPU profiling can perturb the timing being measured.

Performance runs require a hardware-accelerated Metal/ANGLE context and fail if Chromium falls back to SwiftShader. Use `--software-gpu` only for portable correctness and CI smoke runs; never compare its timings with hardware results. Every run records the unmasked GL renderer and vendor in `environment.json`.

Open the trace:

```sh
open https://ui.perfetto.dev
```

Then load `trace.json.gz` and search for `openpencil:`.

## Baseline comparison

Build and run the same gesture against `v0.14.0` and the candidate in separate clean worktrees, on the same machine and power state. Alternate baseline/candidate runs rather than completing every baseline run first. Use release builds, fixed 1280×800 CSS viewport and DPR 2, and at least five measured repetitions after one warmup.

Do not gate shared CI on absolute timing. Dedicated benchmark hardware may gate on same-run baseline ratios and correctness invariants. Always retain raw traces for regressions.

Compare two completed runs:

```sh
bun tools/dev/navigation-benchmark/src/cli.ts compare \
  --baseline artifacts/navigation-benchmark/v0.14.0/metrics.json \
  --candidate artifacts/navigation-benchmark/current/metrics.json \
  --output artifacts/navigation-benchmark/comparison.json
```

## Metrics

The report includes:

- Frame interval median, p95, p99, maximum, and counts over 8.33/16.67/33.33/50 ms.
- Render CPU interval and CanvasKit flush timing.
- Wheel-to-viewport and wheel-to-render-end latency.
- Maximum zoom focal-point drift in screen pixels.
- Maximum presented viewport displacement between rendered frames.
- Final input to exact active-renderer settlement: crisp retained backing for the existing renderer or exact visible tile coverage for tiled mode.
- Tiled scheduler frame count, maximum jobs per frame, maximum measured job submission, over-budget jobs, deadline overrun, and cancelled obsolete jobs.

The runner contains no warmup or settlement sleeps. `waitForSettlement()` requires an idle navigation lifecycle and renderer-owned exact coverage; its timeout rejects the benchmark and reports renderer state.

### Benchmark content mutation and cancellation

Use the exact imported node ID plus a deterministic property mutation to measure selective refresh:

```sh
bun run benchmark:navigation \
  --url 'http://localhost:1420/?renderer=tiled' \
  --gesture tests/fixtures/navigation/gestures/synthetic-repeated-pinch-reversal.json \
  --mode dom \
  --scenario current-document \
  --document tests/fixtures/gold-preview.fig \
  --mutate-node '0:5' \
  --mutate-opacity 0.11 \
  --no-trace \
  --output artifacts/navigation-benchmark/gold-preview-mutation
```

Add `--replay-after-mutation` to wait until refresh is observably pending and then replay the gesture before exact settlement. This measures generation cancellation and final-viewport prioritization without a fixed delay.

Mutation-only and combined runs record their mutation parameters in `environment.json`. For tiled runs, inspect `scheduler.cancelledJobs`, `maximumJobsPerFrame`, `maximumJobRenderMs`, `overBudgetJobs`, and `maximumDeadlineOverrunMs`.

Averages alone are not acceptance criteria. Inspect p95/p99, maximum stalls, contiguous missed frames, motion discontinuities, and crisp-settlement latency.

## Required fixture matrix

Permanent benchmark scenarios should cover:

- **Light:** isolates input and scheduling overhead.
- **Large flat:** stresses culling and traversal.
- **Realistic:** nested frames, text, images, gradients, effects, masks, and instances.
- **Raster stress:** expensive retained-backing creation and coverage changes.
- **Imported `.fig`:** exercises imported-document rendering paths.

Keep large or binary `.fig` fixtures in Git LFS. Synthetic fixture generation must be deterministic.

## Native macOS acceptance

Chromium replay does not establish WKWebView or physical trackpad behavior. Before a release with navigation changes:

1. Build a release-mode Tauri application.
2. Record the same gesture on physical target hardware.
3. Capture Instruments **Time Profiler** and **Core Animation** traces, including OpenPencil and WebKit processes.
4. Check input delivery, main-thread/WASM work, GPU/compositor stalls, viewport continuity, and final crisp settlement.
5. Store the recording, metrics, hardware/macOS metadata, and Instruments trace as release artifacts.

Native automation may add OS-level scroll injection, but it must preserve continuous-scroll and momentum phases before being called trackpad-equivalent. Synthetic composition or DOM wheel events are not native acceptance evidence.
