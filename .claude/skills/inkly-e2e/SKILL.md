---
name: inkly-e2e
description: Inkly editor の Playwright e2e spec を書く / 走らせる / 再現性確保するための skill。 perf 系 (large-doc / mega-doc) / autosave / collab / 通常 UI flow を統一規約で書ける。 fixture (useEditorSetup) / CanvasHelper / waitForRender / perf trace snapshot 出力先 / SwiftShader 配慮 など inkly 固有の patterns を集約する。
user_invocable: true
context: conversation
agent: general-purpose
allowed-tools: Bash, Read, Glob, Grep, Write, Edit
---

# /inkly-e2e — Inkly editor 専用 e2e テスト skill

## いつ使うか (TRIGGER)

- 新規 e2e spec を `tests/e2e/` 配下に追加する時
- 既存 spec の flaky 原因 (timing / async / SwiftShader 由来) を調査する時
- perf 系 spec (`tests/e2e/perf/*.spec.ts`) を追加 / 改修する時
- collab spec / autosave spec を書く時 (multi-page / IndexedDB seed が必要なケース)
- e2e spec の動作を **再現可能な状態** で他環境 (CI / 別マシン) に持っていきたい時
- 「Target crashed」 「flaky」 「only on CI」 のような env 依存問題を調査する時

## いつ使わないか

- 単体テスト (`tests/engine/` 配下、 vitest / bun:test) — それは普通に書く
- e2e fixture そのものの大幅改修 (本 skill は spec を書く側の SSOT)
- Playwright config 自体の編集 (`playwright.config.ts` 直接編集はユーザー判断)

## 1. 規約の SSOT

本 skill が定める e2e spec の規約 6 項目。 全 spec で守る。

| # | 規約 | 根拠 |
|---|---|---|
| 1 | `useEditorSetup()` または `useEditorSetupWithClear()` を使う (`tests/e2e/fixtures.ts`) | beforeAll で 1 page だけ起動、 spec ごとに新規 page 起動しない (Playwright SwiftShader 起動 cost が高い、 1 page 共有が前提) |
| 2 | canvas 操作は `editor.canvas` (`CanvasHelper`) のメソッドを使う | `tests/helpers/canvas.ts` に集約、 bounding box 取得 + mouse 操作 + waitForRender が組まれている |
| 3 | `await editor.canvas.waitForRender()` を mutation 後に呼ぶ | requestAnimationFrame ベースの 1 frame wait、 raw waitForTimeout は使わない |
| 4 | 各 test 末尾で `editor.canvas.assertNoErrors()` を呼ぶ | pageerror / console error を集計、 silent fail を防ぐ |
| 5 | snapshot / 計測 artifact は `.context/scratch/perf-trace/` 配下に出力 | `OUT_DIR` 定数で固定、 git ignore 対象 (session 跨ぎで保管したい場合は `.context/scratch/perf-trace-{tag}/` に複製) |
| 6 | timeout は `test.setTimeout()` で明示 | perf 系 spec は 180_000ms (3 分) を base、 mega-doc は 600_000ms (10 分) |

## 2. spec 種別と template

4 種類の template を用意。 `templates/` 配下を参照。

| 種別 | template | 用途 |
|---|---|---|
| ui-flow | `templates/ui-flow.template.ts` | 通常 UI 操作 (tool 切替 / drag / 保存 / undo 等) |
| perf-trace | `templates/perf-trace.template.ts` | PerfTracer 経由の計測 spec (frame / render / autosave 等) |
| crash-investigation | `templates/crash-investigation.template.ts` | 段階的 phase 観測 + memory snapshot + crash 検出 |
| visual-regression | (`tests/e2e/visual/*.visual.spec.ts` 参照) | 主要 view の見た目崩れ自動検出 (toHaveScreenshot 経由)、 詳細は `references/visual-regression.md` |

template を spec ファイルに copy し、 `seedNodes` / drag step / assertion 部分だけ書き換える。
visual-regression は専用 helper (`tests/helpers/visual.ts` の `waitForVisualReady` / `expectPageScreenshot`) と seed helper (`tests/helpers/api-seed.ts`) を使うので、 既存 spec を参考に作る (`tests/e2e/visual/dashboard.visual.spec.ts` 等)。

## 3. 再現性チェックリスト

新規 spec を追加した時 / flaky を見た時に確認する 7 項目。

- [ ] **viewport / DPR** — `playwright.config.ts` で `viewport: { width: 1280, height: 800 }` `deviceScaleFactor: 2` 固定、 spec 内で変更しない
- [ ] **GPU renderer** — `launchOptions.args: ['--enable-unsafe-swiftshader']` で SwiftShader 強制、 実機 GPU 依存の test は書かない
- [ ] **fonts** — local font access (Noto Sans 等) は SecurityError で warn が出るが test 結果には影響しない、 warn を error と誤検出しないこと
- [ ] **seedNodes** — `cols = ceil(sqrt(n))` の grid 配置で deterministic 配列、 random seed 系は使わない
- [ ] **memory snapshot** — `performance.memory.usedJSHeapSize` は Chromium 専用、 WebKit spec では捕捉不可なので perf 系は WebKit project を避ける
- [ ] **autosave / IndexedDB** — autosave spec は test 前に `await page.evaluate(() => indexedDB.deleteDatabase('inkly-autosave'))` で clean state を作る (autosave-indexeddb.spec.ts 参照)
- [ ] **timing** — `await page.waitForTimeout(N)` の代わりに `editor.canvas.waitForRender()` + `expect(...).toPass({ timeout })` を使う、 raw sleep は avoid

## 4. 既存 spec 一覧と分類

| spec | 種別 | 備考 |
|---|---|---|
| `tests/e2e/perf/large-doc.spec.ts` | perf-trace | 100/500/1000/2000 node の drag 計測、 iter9-iter11 累積効果検証 |
| `tests/e2e/perf/mega-doc.spec.ts` | crash-investigation | 3000/5000/10000 node の静止 phase + 3000 node drag step 切り分け |
| `tests/e2e/perf/trace.spec.ts` | perf-trace | drag chain / autosave / bytes fingerprint / throttle scheduler |
| `tests/e2e/autosave.spec.ts` | ui-flow | autosave throttle / queue 統合動作 |
| `tests/e2e/autosave-indexeddb.spec.ts` | ui-flow | IndexedDB 直接書き込み / 同値 skip |
| その他 `tests/e2e/{ui,design,tools,viewport,app,layers,chat,panels,toolbar}/` | ui-flow | 通常 UI 操作 |

## 5. 実行コマンド

| 操作 | コマンド |
|---|---|
| 単一 spec 実行 | `bunx playwright test --project=inkly tests/e2e/{path}.spec.ts` |
| 名前 grep | `bunx playwright test --project=inkly tests/e2e/{path}.spec.ts -g "{name}"` |
| 全 e2e | `bun run test` (playwright config の inkly project) |
| snapshot 更新 | `bun run test:update` (toHaveScreenshot 系) |
| WebKit project | `bunx playwright test --project=inkly-webkit tests/e2e/ui/tooltips.webkit.spec.ts` |
| trace viewer 表示 | `bunx playwright show-trace test-results/{spec}/trace.zip` |

注 — `webServer.reuseExistingServer: true` 設定なので、 dev server が手動で立っている時はそれを使い回す。 立っていなければ playwright が `bun run dev` を自動起動 (port 1420 + MCP port 7600/7601)。 起動失敗時の典型 error は「Failed to start server. Is port XXXX in use?」 で、 別 process が同 port を握っているケース。

## 6. perf 系 spec 特有の注意

### 6.1 PerfTracer の有効化

PerfTracer は production build では default disable。 spec 内で明示的に enable する。

```typescript
await editor.page.evaluate(() => {
  window.__pencilPerf?.enable()
  window.__pencilPerf?.clear()
})
```

### 6.2 snapshot 保管先

`OUT_DIR = path.resolve(process.cwd(), '.context/scratch/perf-trace')` で固定。 命名規則 `{spec}-{nodeCount}.json` (大規模) または `{phase}.json` (chain 単体)。

iter 比較のために baseline を残す時は `.context/scratch/perf-trace-iter{N}-baseline/` に複製しておく (sessionEnd cleanup の対象外、 PR 後に削除)。

### 6.3 frame max assertion

frame max 閾値は spec 内で明示。 large-doc.spec.ts は 60ms (60Hz の 1/16.7ms x4 margin)、 mega-doc.spec.ts は per-test (3000 node 60ms / 5000 node 100ms 等)。

assertion fail で test failure になるため、 SwiftShader 環境固有の単発 spike (drag 開始 1 frame での picture record + GPU upload) には注意。 必要なら p95 や avg で判定し max は warn 扱いにする。

### 6.4 mega-doc spec の crash 捕捉

`page.on('crash', () => ...)` で renderer process crash を検出。 crash 後は `page.evaluate` が `Target crashed` で reject されるため、 try/catch でラップして snapshot を保存する。

## 7. flaky 調査チェックリスト

spec が intermittent fail する時に確認する 5 項目。

1. **timing race** — `waitForRender` 後 1 frame 待ちで足りない場合は `await page.waitForFunction(() => window.inkly?.getStore?.()?.state.sceneVersion >= N)` で deterministic な待ち合わせに切替
2. **memory pressure** — 連続実行で前 test の state 残留 (IndexedDB / picture cache) が次 test に影響、 `useEditorSetupWithClear` に切替
3. **font loading** — Noto Sans 系 SecurityError は無害、 `if (msg.text().includes('Local font access failed'))` で filter out
4. **port conflict** — `webServer.reuseExistingServer: true` で別 dev server を掴んでいる、 別 port で起動するか dev server を kill
5. **GPU process kill** — drag step 数が多すぎる、 mega-doc spec を参考に dragSteps を 1/3/6 で切り分け

## 8. spec 追加ワークフロー

新規 e2e spec を追加する時の手順。

1. **種別判定** — 種別表 (§2) に従い template を選択
2. **template copy** — `templates/{種別}.template.ts` を `tests/e2e/{category}/{name}.spec.ts` に copy
3. **fixture 配線** — `useEditorSetup` / `useEditorSetupWithClear` のどちらを使うか判断 (clean state が必要なら後者)
4. **seedNodes 書き換え** — fixture 数 / layout / 種別を spec の意図に合わせて変更
5. **assertion 追加** — frame max / count / 期待動作の expect 文を追加
6. **規約チェック** — §3 の 7 項目を全て満たすか self-check
7. **実行** — `bunx playwright test --project=inkly tests/e2e/{path}.spec.ts` で pass 確認
8. **flaky 確認** — 連続 3 回実行で fail がないことを確認 (`--repeat-each=3`)

## 9. 関連ファイル

- `tests/e2e/fixtures.ts` — fixture 本体 (`useEditorSetup` / `useEditorSetupWithClear`)
- `tests/helpers/canvas.ts` — `CanvasHelper` 実装
- `tests/helpers/test-utils.ts` — 汎用 helper
- `playwright.config.ts` — Playwright 設定 (viewport / DPR / SwiftShader)
- `.context/scratch/perf-trace/` — perf snapshot 出力先
- `.context/scratch/perf-trace-iter*-baseline/` — iter 比較用 baseline (PR 後削除)

## 10. references

- `references/perf-trace-format.md` — PerfTracer summary JSON の schema 定義、 stats 配列の field 解説
- `references/swiftshader-quirks.md` — SwiftShader 由来の挙動差 (実機 GPU との閾値乖離、 crash 閾値の SwiftShader assume 規約)
- `references/canvaskit-resource-lifecycle.md` — Picture / Surface / Image の delete タイミング規約 (memory leak / GPU pressure 防止)
- `references/visual-regression.md` — visual regression spec (tests/e2e/visual/) の inkly 固有 patterns、 baseline 更新手順、 SwiftShader / font 影響と対策、 seed helper 活用
