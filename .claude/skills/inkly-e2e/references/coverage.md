# Coverage Measurement — inkly e2e patterns

`tests/e2e/` の coverage は default off。 Playwright の JS coverage は Chromium 限定かつ重いので、今の repo では demo spec だけを opt-in で計測する。

## 1. 実行コマンド

```sh
bun run coverage:unit
bun run coverage:e2e:demo
bun run coverage:report
```

| コマンド | 目的 | 出力 |
|---|---|---|
| `bun run coverage:unit` | bun:test coverage を LCOV 化 | `.context/coverage/unit/lcov.info` |
| `bun run coverage:e2e:demo` | `dashboard.interaction.spec.ts` の production-bundle JS coverage + trace | `.context/coverage/e2e/lcov.info`, `.context/coverage/e2e/traces/` |
| `bun run coverage:report` | unit + e2e demo の LCOV 集約と未カバー file 可視化 | stdout summary |

artifact は `.context/coverage/` 配下に固定し、 git には載せない。

## 2. threshold の推奨初期値

unit coverage の baseline は以下を SSOT とする。

- lines: 60%
- functions: 60%
- statements: 60%
- branches: 50%

`bunfig.toml` の `coverageThreshold` に入れる値はこの baseline を使う。 実測が安定して 80%+ なら follow-up で引き上げる。

注:

- Bun 1.3.14 は LCOV に branch records を出さない
- そのため merged report の `branches` は現状 `n/a`
- `branches = 0.5` は将来の Bun native support を見越した forward declaration として維持する

## 3. e2e coverage の scope

今 PR では全 spec を測らない。 重いので demo 1 本だけに絞る。

- 対象 spec: `tests/e2e/interaction/dashboard.interaction.spec.ts`
- browser: Chromium (`--project=inkly`)
- capture: `page.coverage.startJSCoverage()` / `stopJSCoverage()`
- trace: `playwright --trace=on`

spec を増やす時は「coverage helper を入れる → production preview で実行する → LCOV に変換する」の 3 段を踏む。

## 4. LCOV の読み方

`coverage:report` は以下を出す。

- unit / e2e / merged の summary 行
- statements / branches / lines / functions の %
- 未カバー file 数
- uncovered line 数が多い上位 5 file

優先順位は次の順で付ける。

1. uncovered line 数が多い file
2. editor core / scene graph / file format など壊れやすい中核ロジック
3. recently changed file
4. UI glue より pure function / codec / transform 系

## 5. 運用ルール

- coverage artifact は毎回上書きでよい。 長期保存はしない
- E2E coverage は CI 常時実行にしない。 local / opt-in 前提
- coverage を上げるためだけの shallow test は避け、 未カバー分岐の実動作を assert する
- summary の数字だけでなく、 未カバー file list を review comment や follow-up issue に落とす
