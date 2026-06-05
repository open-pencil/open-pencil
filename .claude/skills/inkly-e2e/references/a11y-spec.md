# Accessibility Spec — inkly 固有 patterns

`tests/e2e/a11y/` 配下の `*.a11y.spec.ts` で `@axe-core/playwright` を使い、 主要 view と editor chrome の WCAG 2.1 AA 違反を自動検出する。
本 reference は inkly 固有の helper、 impact 判定、 false positive 対策、 既知違反の document 化ルールをまとめる。

## 1. 配置と命名規約

```
tests/e2e/a11y/
├── account.a11y.spec.ts
├── boards-settings.a11y.spec.ts
├── dashboard.a11y.spec.ts
├── editor.a11y.spec.ts
├── notifications.a11y.spec.ts
├── team-detail.a11y.spec.ts
└── teams.a11y.spec.ts
```

| 規約 | 詳細 |
|---|---|
| spec ファイル名 | `{view-name}.a11y.spec.ts` |
| describe block | `describe('{view name} accessibility', ...)` |
| test 名 | `'{state} has no critical accessibility violations'` |
| helper | `tests/helpers/a11y.ts` の `runA11yScan()` と `expectNoCriticalViolations()` を使う |
| wait | scan 前に `waitForVisualReady(page)` を通す |

## 2. 基本パターン

```typescript
import { expect, test } from '@playwright/test'

import { runA11yScan, expectNoCriticalViolations } from '#tests/helpers/a11y'
import { cleanState } from '#tests/helpers/api-seed'
import { waitForVisualReady } from '#tests/helpers/visual'

test.describe('dashboard accessibility', () => {
  test.beforeEach(async ({ page }) => {
    await cleanState(page)
  })

  test('empty state has no critical accessibility violations', async ({ page }) => {
    await page.goto('/boards')
    await expect(page.getByTestId('boards-view')).toBeVisible()
    await waitForVisualReady(page)

    const results = await runA11yScan(page)
    expectNoCriticalViolations(results)
  })
})
```

flow は常に `seed -> goto -> visible assert -> runA11yScan -> expectNoCriticalViolations` の順にする。

## 3. helper の責務

### 3.1 `runA11yScan(page, options)`

- `include` — scan 対象 subtree を CSS selector で限定
- `exclude` — canvas や loading UI など検査対象外 subtree を除外
- `disableRules` — 既知違反を一時的に skip する rule id の配列

editor では canvas 自体を検査しない:

```typescript
const results = await runA11yScan(page, {
  include: [
    '[data-test-id="toolbar"]',
    '[data-test-id="layers-panel"]',
    '[data-test-id="properties-panel"]'
  ],
  exclude: [
    '[data-test-id="canvas-area"]',
    '[data-test-id="canvas-loading"]'
  ]
})
```

### 3.2 `expectNoCriticalViolations(results)`

- `critical` と `serious` は test failure
- `moderate` と `minor` は `console.warn` に流し、 fail にはしない
- failure message には `rule id` `help` `helpUrl` `target selector` を含める

## 4. impact レベルの扱い

axe の violation は `minor` / `moderate` / `serious` / `critical` の impact を持つ。

| impact | この repo での扱い | 方針 |
|---|---|---|
| `critical` | fail | 別 PR でも良いが block 扱い |
| `serious` | fail | 同上 |
| `moderate` | warn | 修正候補として backlog 化 |
| `minor` | warn | 低優先、 ただし再現容易なら修正検討 |

target は WCAG 2.1 AA。 axe default rules を使い、 repo 側で ruleset を狭めない。

## 5. false positive / noisy state 対策

### 5.1 scan 前の wait

- `waitForVisualReady(page)` で `networkidle` + `document.fonts.ready` + `requestAnimationFrame` x2 を待つ
- editor は `waitForVisualReady(page, { canvas })` を使い、 DOM 側だけでなく canvas 初期化完了も待つ

### 5.2 exclude すべきもの

- CanvasKit の canvas DOM (`[data-test-id="canvas-area"]`)
- canvas 初期化中 overlay (`[data-test-id="canvas-loading"]`)
- 一時的な loading candidate (`[data-test-id="mention-loading"]` など)
- アプリ本体ではなく browser / test harness 側が出す一時 overlay

### 5.3 disableRules の使い方

既知違反を一時回避する時だけ使う。 永続的な無効化は避ける。

```typescript
const results = await runA11yScan(page, {
  disableRules: [
    // TODO(cardene): `color-contrast` は別 PR で修正予定
    'color-contrast'
  ]
})
```

コメント無しの `disableRules` は禁止。 必ず「別 PR で fix 予定」 を明記する。

## 6. 既知違反を放置する場合の document 化規約

rule を disable する時は、 spec の直上または option の近くに以下 3 点を書く。

1. rule id (`color-contrast` など)
2. disable 理由 (false positive か、 実違反だが別 PR で修正予定か)
3. 修正予定を明記 (`TODO(cardene): ... in follow-up PR`)

必要なら issue / PR 番号も追記する。

## 7. 対象 state の考え方

最低限、 各 view で次を押さえる。

| view | 推奨 state |
|---|---|
| Dashboard | empty / populated |
| Board Settings | empty / populated / destructive dialog |
| Teams | empty / populated / create modal |
| Team Detail | owner-only / populated / invite modal |
| Notifications | empty / populated / popover |
| Account | anonymous / signed-in |
| Editor | default chrome / selected-shape chrome |

view 単位の coverage が目的なので、 同じ DOM を別 spec で重複走査しすぎない。

## 8. 関連

- `tests/helpers/a11y.ts`
- `tests/helpers/api-seed.ts`
- `tests/helpers/visual.ts`
- `.claude/skills/inkly-e2e/SKILL.md`
- axe-core API docs: https://www.deque.com/axe/core-documentation/api-documentation/
