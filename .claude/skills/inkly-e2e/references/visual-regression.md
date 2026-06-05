# Visual Regression Test — inkly 固有 patterns

`tests/e2e/visual/` 配下の `*.visual.spec.ts` で Playwright の `toHaveScreenshot()` を使い、 主要 view の見た目崩れを自動検出する。
本 reference は inkly 固有の規約 + baseline 更新手順 + SwiftShader / font の影響と対策を集約する。

## 1. 配置と命名規約

```
tests/e2e/visual/
├── account.visual.spec.ts          # /account view
├── board-settings.visual.spec.ts   # /board/:id/settings view
├── dashboard.visual.spec.ts        # /boards view
├── notifications.visual.spec.ts    # /notifications view + NotificationBell popover
├── team-detail.visual.spec.ts      # /team/:id view
├── team-settings.visual.spec.ts    # /team/:id/settings view
├── teams.visual.spec.ts            # /teams view
└── __snapshots__/                  # baseline png (git tracked)
    ├── dashboard-empty.png
    ├── dashboard-populated.png
    └── ...
```

| 規約 | 詳細 |
|---|---|
| spec ファイル名 | `{view-name}.visual.spec.ts` (e.g. `dashboard.visual.spec.ts`) |
| snapshot 名 | `{view-name}-{state}.png` (e.g. `dashboard-empty.png`) |
| 保存先 | `tests/e2e/visual/__snapshots__/` (git tracked、 PR review 時は diff で目視確認) |
| describe block | `describe('{view name} visual regression', ...)` で grouping |
| test 名 | `'{state} state'` (例 `'empty state'`、 `'populated state'`) |

## 2. 必須の wait 経路 (waitForVisualReady helper)

screenshot 取得前に必ず以下の wait を経由する。 `tests/helpers/visual.ts` の `waitForVisualReady(page)` helper が一括処理する。

```typescript
import { waitForVisualReady, expectPageScreenshot } from '#tests/helpers/visual'

test('empty state', async ({ page }) => {
  await page.goto('/boards')
  await waitForVisualReady(page)
  await expectPageScreenshot(page, 'dashboard-empty.png')
})
```

`waitForVisualReady` の内訳:
1. `page.waitForLoadState('networkidle')` — XHR / WebSocket の inflight 終了を待つ
2. `page.waitForFunction(() => document.fonts.ready)` — font loading 完了
3. `page.evaluate(() => new Promise(requestAnimationFrame))` x2 — Vue reactive flush + browser paint
4. (optional) `canvas.waitForRender()` — canvas を含む view の場合

font loading を待たないと SwiftShader 環境で text が部分的に system font fallback で render され snapshot diff が出る。

## 3. SwiftShader / font による影響と対策

| 症状 | 原因 | 対策 |
|---|---|---|
| 同一 spec が flaky に diff | font race / 非同期 render | `waitForVisualReady` を必ず通す |
| 別マシン / CI で大量 diff | OS font 差 (Mac vs Linux) | local font (Noto Sans 等) を bundle、 system font に依存しない |
| Noto Sans XX SecurityError warn | local font access API user activation 要求 | 警告無視、 console error filter で除外 |
| timestamp / date の差 | 動的データ (created_at 等) | seed helper で `createdAt` を固定値に注入 |
| collaborator avatar 色 | anonymous_id の hash で決まる | seed helper で `anonymousId` を固定 |

## 4. seed helper (tests/helpers/api-seed.ts)

visual spec は deterministic な state を作るため API seed helper を活用する:

```typescript
import { seedBoards, seedTeam, seedNotifications, cleanState } from '#tests/helpers/api-seed'

test.beforeEach(async ({ page }) => {
  await cleanState(page)  // DB を in-memory reset
})

test('populated state', async ({ page }) => {
  await seedBoards(page, { count: 3 })
  await page.goto('/boards')
  // ...
})
```

helper 一覧:
- `seedBoards(page, { count, anonymousId? })` — board を N 件作成
- `seedTeam(page, { name, members? })` — team + member を作成
- `seedNotifications(page, { count, readRatio? })` — 通知を生成 (read/unread 混在)
- `cleanState(page)` — DB in-memory reset (test 間 isolation)

backend に `POST /api/__test__/seed` / `POST /api/__test__/reset` endpoint があり、 test 環境 (`INKLY_API_DB_MODE=memory`) でのみ動作する (production では 404)。

## 5. baseline 更新手順

view 変更で snapshot が古くなったら baseline を更新する:

```bash
# 1 つの spec だけ更新
bunx playwright test --project=inkly tests/e2e/visual/dashboard.visual.spec.ts --update-snapshots

# 全 visual spec 更新
bunx playwright test --project=inkly tests/e2e/visual/ --update-snapshots
```

更新後は git diff で baseline png を目視確認 → commit。

```bash
git diff --stat tests/e2e/visual/__snapshots__/
git add tests/e2e/visual/__snapshots__/{updated-files}.png
git commit -m "🧪 test(visual): update baseline for {view-name} after {reason}"
```

意図せず baseline が変わった場合は revert し、 view 側の修正を行ってから再生成する。

## 6. 推奨 state バリエーション

各 view で以下の state を snapshot 化する (最低限の coverage):

| view | state |
|---|---|
| Dashboard | empty / populated / search 入力中 / LoginBanner (anonymous) |
| Board 設定 | invitation empty / populated / revoke confirmation |
| Teams | empty / populated / create modal |
| Team Detail | owner-only / 3 member / invite modal |
| Team Settings | 標準 / role 変更 modal / delete confirmation |
| Notifications | empty / 混在 (read/unread) / bell popover |
| Account | 未 login / login 済み |

新規 view を追加した時は同様に empty + populated + interactive state (modal / popover) を最低 3 snapshot 作る。

## 7. snapshot diff の許容範囲

`playwright.config.ts` の default:
```typescript
toHaveScreenshot: {
  maxDiffPixelRatio: 0.01,
  threshold: 0.3
}
```

- `maxDiffPixelRatio: 0.01` = pixel 差 1% まで許容 (font anti-aliasing / sub-pixel render の微小差)
- `threshold: 0.3` = pixel 比較の threshold (0-1、 RGBA 距離正規化)

意図しない diff が出た場合は spec 個別に `expect(...).toHaveScreenshot('name.png', { maxDiffPixelRatio: 0.02 })` で override 可能だが、 過度に緩めない (regression を見逃す)。

## 8. CI / 別 device での運用

| 環境 | 注意点 |
|---|---|
| 同マシン (local) | 安定、 SwiftShader 固定 + font bundle で deterministic |
| 別 mac (M1/M2 等) | font rendering の sub-pixel 差で diff 出る可能性、 baseline 再生成必要 |
| Linux CI (docker) | SwiftShader 同じだが font が異なる、 専用 baseline branch 必要 |
| Windows | font / DPR 大幅差、 visual spec 非対応 (機能 spec のみ) |

CI 専用 baseline を持つ場合は `__snapshots__-ci/` 等で分離し、 `playwright.config.ts` で env 別に切り替える (今 PR では未実装、 必要なら別 PR で追加)。

## 9. 既存 spec との関係

- `tests/e2e/scene/cache.spec.ts` — canvas snapshot 系 (rendering cache の visual verification)、 visual.spec.ts と独立
- `tests/e2e/{board,team,auth,notifications}/` — flow assertion 系、 visual.spec.ts と orthogonal
- visual.spec.ts は flow を assert せず純粋に「見た目」 のみ verify、 機能 regression は他 spec で別途検知

## 10. 関連

- `tests/helpers/visual.ts` — `waitForVisualReady` / `expectPageScreenshot` helper
- `tests/helpers/api-seed.ts` — seed helper
- `packages/api/src/routes/testing.ts` — test 専用 seed / reset endpoint
- `.claude/skills/inkly-e2e/SKILL.md` — 全 e2e 規約の SSOT
- Playwright visual regression docs https://playwright.dev/docs/test-snapshots
