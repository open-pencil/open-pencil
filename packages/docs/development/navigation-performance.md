# Navigation performance benchmark

The navigation benchmark measures the complete wheel/trackpad-to-render pipeline. It is intentionally separate from the synchronous microbenchmark in `tests/e2e/viewport/zoom-pan.spec.ts`: accepting JavaScript calls quickly does not prove smooth navigation.

## What it captures

Every run writes:

- `trace.json.gz`: Chromium tracing data for Perfetto or Chrome tracing tools.
- `recording.json`: wheel samples plus OpenPencil input, viewport, render, and retained-backing events.
- `metrics.json`: frame pacing, input latency, zoom-anchor drift, viewport jumps, and time to a crisp backing.
- `environment.json`: browser, runtime, replay mode, and source gesture information.

OpenPencil emits User Timing marks under `openpencil:*`, including wheel receipt/flush, viewport mutation, render start/end, backing preview/build, and crisp-backing completion. The recording also runs a continuous `requestAnimationFrame` heartbeat and observes browser Long Tasks, so display stalls remain visible even when OpenPencil does not render.

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

Use `current-document` with an explicit browser-served fixture path. The runner waits for loading and page population, applies layout through the normal document-open path, zooms to fit, and lets fonts/images/initial backing settle before recording:

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
bun tools/navigation-benchmark/src/cli.ts compare \
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
- Final input to crisp retained-backing completion.

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
