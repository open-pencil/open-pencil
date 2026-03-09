# Testing

## Overview

| Type | Framework | Command | Location |
|------|-----------|---------|----------|
| Unit tests | bun:test | `bun run test` | `tests/engine/` |
| E2E visual regression | Playwright | `bun run test:e2e` | `tests/e2e/` |
| Figma CDP reference | Playwright | `bun run test:e2e:figma` | `tests/figma/` |

## Unit Tests

Engine unit tests use bun:test and target < 50ms execution:

```sh
bun run test
```

Tests cover:
- Scene graph CRUD operations, parent-child relationships, z-ordering, hit testing
- **Fig-import pipeline** — node type mapping, transforms, fills/strokes/effects, gradients, images, arcs, nested hierarchies (`tests/engine/fig-import.test.ts`)
- **Layout computation** — Yoga auto-layout: direction, gap, padding, justify, align, child sizing (fixed/fill/hug), cross-axis sizing, wrap, nested layouts (`tests/engine/layout.test.ts`)

### Writing Unit Tests

```typescript
import { describe, expect, it } from 'bun:test'
import { SceneGraph } from '../../src/engine/scene-graph'

describe('SceneGraph', () => {
  it('creates and retrieves a node', () => {
    const sg = new SceneGraph()
    const node = sg.createNode('RECTANGLE', sg.root, { name: 'Test' })
    expect(sg.getNode(node.guid)).toBeDefined()
  })
})
```

## E2E Visual Regression

Playwright creates shapes on the canvas and compares screenshots against baseline PNGs. Browsers must be installed first:

```sh
bun run test:e2e:install   # one-time: download browsers
bun run test:e2e           # run tests, compare against baselines
bun run test:e2e:update    # regenerate baseline screenshots
```

### How It Works

1. Tests load the editor in a headless browser
2. The editor signals readiness via a `data-ready` HTML attribute
3. Tests create shapes via the editor's API
4. Screenshots are taken and compared against baselines using `toMatchSnapshot`
5. Page is reused across test cases for speed (~2s total)

### No-Chrome Test Mode

The editor supports a test mode that hides UI chrome (toolbar, panels) for clean screenshot capture. Activated via URL parameter.

## Figma CDP Reference Tests

A separate Playwright project connects to Figma via Chrome DevTools Protocol to capture reference screenshots for pixel-perfect comparison.

```sh
open -a Figma --args --remote-debugging-port=9222   # launch Figma with debugging port
bun run test:e2e:figma                               # connect to Figma, capture references
```

Requires Figma desktop app running with `--remote-debugging-port=9222`.

## E2E Test Coverage

| Test file | Scope |
|-----------|-------|
| `tests/e2e/layers-panel.spec.ts` | Layers panel tree structure, visibility toggles, selection sync |
| `tests/e2e/visual.spec.ts` | Visual regression screenshots for shapes and rendering |

## Test Helpers

| File | Purpose |
|------|---------|
| `tests/helpers/canvas.ts` | Canvas setup and interaction utilities |
| `tests/helpers/figma.ts` | Figma CDP connection helpers |

## Performance Targets

| Metric | Target |
|--------|--------|
| E2E suite total | < 3s |
| Unit test suite total | < 50ms |
| Screenshot comparison | toMatchSnapshot (pixel-level) |
