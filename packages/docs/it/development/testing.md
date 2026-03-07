# Testing

## Panoramica

| Type | Framework | Command | Location |
|------|-----------|---------|----------|
| E2E visual regression | Playwright | `bun run test` | `tests/e2e/` |
| Figma CDP reference | Playwright | `bun run test:figma` | `tests/figma/` |
| Unit tests | bun:test | `bun run test:unit` | `tests/engine/` |

## Regressione visuale E2E

```sh
bun run test              # Compare against baselines
bun run test:update       # Regenerate baselines
```

1. Playwright → headless browser
2. `data-ready` HTML attribute
3. Create shapes → screenshot → `toMatchSnapshot`

## Test di riferimento Figma CDP

```sh
bun run figma:debug       # Launch Figma with debugging port
bun run test:figma        # Connect via CDP
```

## Test unitari

```sh
bun run test:unit
```

- Scene graph CRUD, hit testing
- Fig-import pipeline
- Layout computation (Yoga)
- MCP server edge cases

## Copertura test E2E

| Test file | Scope |
|-----------|-------|
| `tests/e2e/layers-panel.spec.ts` | Layers panel |
| `tests/e2e/visual.spec.ts` | Visual regression |

## Obiettivi di prestazione

| Metric | Target |
|--------|--------|
| E2E suite | < 3s |
| Unit tests | < 50ms |
