# Reviewer Checklist

`pencil-design` skill の生成後レビュー step で使う品質判定 checklist。
各画面の PNG export を Read して以下 8 項目を確認、 1 件でも NG なら修正ループへ。

## 1. 中身ゼロでないか (CRITICAL)

PNG が「ほぼ真っ白」「title + sub だけ」「placeholder のまま」のいずれかなら **不合格**。

NG の典型:
- 画面が背景色のみで描画要素ゼロ
- title 1 行 + sub 1 行だけで他の要素が無い
- placeholder の frame だけで content 未実装

OK の最低基準:
- 仕様書「画面一覧」の「主要要素」列の項目が全て visible に存在
- 各画面で **5 個以上の独立した UI 要素** (card / button / table row / chart / form field 等) が描画されている

## 2. 仕様書の「主要要素」を全て含むか (CRITICAL)

仕様書の 4. 画面一覧 で各画面ごとに列挙されている主要要素を 1 つずつ確認。

例 (Stride/Home の場合):
- [ ] sidebar
- [ ] topbar (breadcrumb / search / actions)
- [ ] greeting + 日付
- [ ] KPI cards 6 件 (在籍 / 採用中 / 評価進捗 / 離職率 / 給与確定 / 法令アラート)
- [ ] Activity timeline
- [ ] 自部下進捗 (Manager 時)

1 件でも欠落 → 不合格、 該当要素を追加実装。

## 3. visible contrast (4.5:1) を満たすか

card / border / text の contrast が visible に見える levels に達しているか。

判定基準:
- card は bg と clearly 区別可能 (border or shadow or 異なる fill)
- text は背景と clearly 区別可能 (絶対値 not 「ほぼ白」)
- transparent fill + 薄い stroke の組み合わせ禁止 (inkly では描画失敗しやすい)

NG の典型:
- bg #FFFFFF + card #FFFFFF + border #E5E7EC (差 0)
- transparent fill の frame に薄い stroke
- text が透明 fill (絵文字含む)

OK の最低基準:
- card は **明示的に異なる fill** (bg slate-50 / card white) または **shadow** で区別
- border 使う場合は **#D1D5DB 以上** (slate-300)
- text fill は **明示的に hex 指定** (default 透明回避)

## 4. layout 崩れなし (CRITICAL)

PNG で確認:
- 画面 frame 外への要素はみ出しなし (clipsContent = true 必須)
- 子要素同士の overlap なし
- 文字が縦に 1 文字ずつ折り返されてない (textAutoResize 罠)

NG の典型:
- 文字が縦に折り返し ("c\na\nn\nv\na\ns")
- frame からはみ出した要素
- 要素重なり

OK の判定:
- 全要素が frame 内に収まる
- 文字は横書きで 1 行 or 適切な改行

## 5. 画面 ID + name tag が左上に存在

各画面の frame 外左上に画面 ID (M-01 / C-01 等) + name (Marketing/Landing 等) が tag として配置されているか。 これは reviewer が画面を識別するための必須要件。

## 6. 標準数値を守っているか

mobile / web-app reference の数値 spec が守られているか:
- Mobile: Status Bar 62 / Tab Bar 36 radius / Tab item 26 / Icon 18 / Label 10
- Web: Sidebar 240 / Topbar 64 / Card padding 24 / Card radius 12 / Page padding 32
- Slides: 16:9 1920x1080 / min fontSize 28 / edge 100+
- Spacing: 4 / 8 / 12 / 16 / 24 / 32 / 48 / 64

## 7. テキストが意味のある content か

placeholder の "Lorem ipsum" や "..." だけになってないか:
- 仕様書のコピー方向性に従って意味のある日本語 or 英語 が入っているか
- 数値 KPI は仕様書通りの値 (187 名 / 12 件 等)
- 「タイトル」「ラベル」のような generic 文字列ではなく「在籍 / 採用中 / 評価進捗」のような具体的な名前

## 8. fig + pen の両方が正しく出力されているか

- design/<product>.fig が存在
- design/<product>.pen が存在
- pen は inkly CLI で読み込み可能 (`bun $INKLY info <product>.pen` でエラー無し)

## 修正ループの上限 (v2 厳格化)

| 観点 | 値 |
|---|---|
| 1 file あたり最大 round | 5 |
| ループ終了条件 | `fix_proposals` が全画面で空 (overall PASS だけでは終わらせない) |
| skip マーキング trigger | 同じ fix proposal が 2 round 連続で出現 |
| skip マーキング先 | `<repo>/.context/pencil-design/<product>-<scope>-fix-state.md` |
| skip 理由分類 | out-of-scope / 構造不可能 / 仕様書外 / inkly 制約 |
| 5 round 到達時 | AskUserQuestion で「未解決 N 件 残ります、 続行 / 残件 skip / 中断」 |
| 同じ failure mode 連続 | 2 round で skip マーキング、 3 round 以降は再提案禁止 |

## skip マーキングの schema

```markdown
# <product>/<scope> fix-state

| screen | round | skip 内容 | 理由 |
|---|---|---|---|
| O-01 | 3 | sub-label を絵文字 ▶ にする | inkly emoji glyph 不在で代替不可、 letter monogram で既に対応済み |
| M-02 | 4 | FAQ 6 件に拡張 | 仕様書 §4 画面一覧に 4 件と明記、 仕様書外 |
```

skip した項目は次ラウンドの reviewer prompt 内に「**前 round で skip マーキング済み (再提案禁止)**」として渡す:

```
前 round で skip マーキングした項目 (再提案禁止):
- O-01: sub-label を絵文字 ▶ にする (理由 — inkly emoji glyph 不在で代替不可、 letter monogram で既に対応済み)
- M-02: FAQ 6 件に拡張 (理由 — 仕様書 §4 画面一覧に 4 件と明記、 仕様書外)
```

## 完了基準 (fix_proposals = 0 で初めて完了報告、 v2 厳格化)

| 基準 | 内容 |
|---|---|
| 全画面 7 項目 PASS かつ fix_proposals = 0 | overall PASS だけでは不十分、 fix_proposals が空でない限り次 round |
| ユーザーへの正直報告 | 「完了しました」ではなく「N 画面 PASS / fix_proposals 0 件 / skip マーキング M 件 (理由付き)」を明示 |
| skip マーキング report 必須 | 完了報告に skip した項目 list を **必ず** 列挙、 隠さない |
| 視覚 PNG 添付 | 全画面 overview PNG + 個別画面 PNG を `<repo>/.context/pencil-design/` 配下 or `/tmp/` に保存して Read |
| 妥協報告禁止 | 「動作実証としては成立」「skeleton で完成扱い」「PASS だから fix_proposals は無視 OK」は禁止 |

完了報告テンプレート (v2):

```
🎉 <product>/<scope> 完了報告

| file | 画面数 | reviewer 判定 | fix_proposals | skip マーキング |
|---|---|---|---|---|
| replay-core.fig | 15 | 15/15 PASS Grade A | 0 件 | 0 件 |
| replay-marketing.fig | 13 | 13/13 PASS Grade A | 0 件 | 1 件 (M-02 FAQ 6 件拡張 — 仕様書外) |
| replay-settings.fig | 13 | 13/13 PASS Grade A | 0 件 | 0 件 |

合計 41 画面、 fix_proposals 0 件、 skip マーキング 1 件 (理由 — 仕様書外)。
```

## Reviewer agent (Agent tool subagent)

レビューは Agent tool で副タスクとして実行 (主スレッドのバイアス防止)。

```
Agent({
  description: "Stride 27 画面の品質レビュー",
  subagent_type: "general-purpose",
  prompt: `
あなたは Stride プロジェクトのデザインレビュアーです。
仕様書 design/specs/stride.md を Read してから、 各画面の PNG を順に Read して
references/reviewer-checklist.md の 8 項目で採点してください。

各画面ごとに以下フォーマットで報告:

## 画面 <ID> <name>
| 項目 | 結果 | 詳細 |
|---|---|---|
| 1. 中身ゼロでない | PASS/NG | (NG なら理由) |
| 2. 主要要素全て含む | PASS/NG | (欠落要素を列挙) |
| 3. contrast 4.5:1 | PASS/NG | |
| 4. layout 崩れなし | PASS/NG | |
| 5. ID tag 存在 | PASS/NG | |
| 6. 標準数値 | PASS/NG | |
| 7. 意味ある content | PASS/NG | |
| 8. fig + pen 出力 | PASS/NG | |

総合: PASS / NG (NG の場合、 修正すべき要素を箇条書きで)

入力:
- 仕様書: design/specs/stride.md
- 全画面 PNG: /tmp/stride-<screen-id>.png (個別)
- overview PNG: /tmp/stride-overview.png

出力: JSON 形式で各画面の判定結果と修正提案
{
  "results": [
    {
      "id": "M-01",
      "name": "Marketing/Landing",
      "overall": "PASS|NG",
      "checks": {...},
      "fix_proposals": [...]
    },
    ...
  ],
  "summary": {
    "pass_count": N,
    "ng_count": M,
    "critical_issues": [...]
  }
}
`
})
```

reviewer の判定結果が JSON で返るので、 主スレッドは NG 画面だけ修正ループに入る。
