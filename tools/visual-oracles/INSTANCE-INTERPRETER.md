# Experimental instance interpreter render check

Run from the repository root after installing dependencies:

```sh
bun tools/visual-oracles/src/operations/interpret-instance.ts \
  --file tests/fixtures/gold-preview.fig --node 1:3503 \
  --scale 2 --output /tmp/gold-input-comparison
```

To also export the matching node from Figma, open the original gold-preview document
and add `--figma-key NmoHzskYNiSKOaRX14bMdw`. The command checks the active file key
and uses `exportAsync` with an explicit scale, rather than relying on saved export settings.

Outputs: `interpreted.png`, `report.json` (font status, unresolved paths and node
bounds), and optionally `figma.png` and `figma-bounds.json`.

The interpreted tree is rendered directly through Skia. No legacy import or FIG
round trip is used. Font preparation must not change occurrence bounds, and missing
fonts fail the command. Layout is intentionally not recomputed.

This is diagnostic tooling, not a passing visual-regression assertion. Current
Gold Preview input observations: matching 788 × 83 output bounds at 2×, correct
badge/avatar visibility and explicit placeholder font size, but remaining pixel
differences. Derived geometry, typography, and unresolved-path diagnostics remain
experimental. Do not use a low pixel difference count alone as proof of correctness.
