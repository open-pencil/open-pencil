# Web App System Prompt (公式移植)

Pencil 公式 `# WEBAPP SYSTEM PROMPT` セクションを忠実移植。
CRM / analytics / editor / marketplace / fintech / admin panel / AI tool / SaaS dashboard 等、 機能的プロダクト UI の設計に適用。

## 適用範囲

- CRM・analytics・editor・marketplace
- fintech・admin panel・AI tool
- SaaS dashboard・unknown future systems

含まれない (= 別 reference へ):
- マーケティング LP → `references/landing-page.md`
- mobile app screen → `references/mobile-app.md`
- presentation slides → `references/slides.md`

## 16 原則 (絶対遵守)

公式 prompt そのまま。 各原則を生成前に reflect する。

### 1. Purpose First

screen ごとに primary purpose を 1 つだけ定義する。

- 1 screen = 1 dominant user question
- 1 screen = 1 primary action
- 複数目的が競合するなら別 surface に分ける
- 多目的 cluttered screen 禁止

### 2. Dominant Region Rule

screen には dominant visual region を 1 つ持たせる。

- visual weight = 重要度
- secondary region は subordinate
- equal-weight layout 禁止
- 競合する focal point 禁止
- hierarchy 必須

### 3. Understandability

interface は自己説明的に。

- label は明確
- action は認識可能
- icon で essential text を置き換えない
- system state は可視
- 推測必要なら redesign

### 4. Progressive Disclosure

complexity は段階的に出す。

- essential information first
- advanced controls は contextual
- 全 capability を一気に出さない
- detail view は on demand

### 5. Recognition Over Recall

cognitive load を減らす。

- 必要な action を必要なときに surface
- 過去 state を覚えさせない
- navigation は predictable
- control の位置は consistent

### 6. System Status Visibility

system は常に state を伝える。

全 data-driven surface は以下を持つ。

- loading state
- empty state
- error state
- success confirmation
- permission / restriction state (該当時)

silent failure / blank ambiguity 禁止。

### 7. Action Hierarchy

action は logical に scale する。

- 1 screen / section に primary action 1 つ
- secondary action は visually reduced
- destructive action は distinct
- 稀な action は overflow

### 8. Structural Consistency

pattern を system 横断で repeat する。

- 似た問題 → 似た解
- navigation logic は stable
- layout rhythm は system-driven
- spacing は consistent scale

### 9. Density Intentionality

density は deliberate に決める。

| mode | 用途 |
|---|---|
| Compact | high data 環境 |
| Medium | balanced default |
| Airy | low-complexity workflow |

1 screen 内で arbitrary に density を mix しない。

### 10. Spatial Logic

layout は architectural。

- 1 screen に dominant axis 1 つ
- 3 つ前に 2 structural zones を試す
- 不要な nested scroll container を避ける
- separation は whitespace で
- 装飾的 divider は機能的必要時のみ

### 11. Feedback & Response

全 user action に clear feedback。

- immediate acknowledgment
- clear validation messaging
- reversible action を優先
- destructive operation は confirm

silence は禁止。

### 12. Responsiveness

hierarchy は全 breakpoint で生き残る。

| device | rule |
|---|---|
| Mobile | single dominant column / secondary は sheet or stacked / horizontal scroll 禁止 (必要時除く) |
| Tablet | 過渡的 structural logic |
| Desktop | multi-zone / higher density 許容 |

### 13. Entity Integrity

entity (user / record / document / asset) を表示するとき:

- name を prominently 表示
- status を clear に
- key metadata を出す
- action を obvious に

entity は concrete / usable に感じさせる。

### 14. Constraint Over Decoration

要素が以下のいずれも支えないなら **存在させない**:

- navigation
- understanding
- decision-making
- action-taking

「as little design as possible」。

### 15. Scalability

design 決定は scale する。

- data 増えても structure 壊れない
- feature 増えても hierarchy 崩れない
- growth = pattern 拡張、 chaos 化禁止

### 16. Adaptation Logic

prompt から product type を infer して以下を決める:

- dominant region
- primary action
- 適切な density
- progressive disclosure level

dashboard / table / sidebar / canvas を「とりあえず」採用しない。 structure は utility から emerge する。

## 実装フロー (web app 向け)

```
1. mcp__inkly__get_selection / get_current_page / get_components
2. references/general-rules.md を Read
3. (この file) を Read
4. mcp__inkly__list_variables で既存トークン取得
5. references/style-guides/ を見て tone 決定 (任意)
6. mcp__inkly__get_page_tree で既存 layout 把握
7. mcp__inkly__create_instance / render / set_layout / update_node で生成 (25 op cap)
8. mcp__inkly__export_image で視覚検証
9. 必要なら 7-8 反復
```

## 典型構成 (Recommended baselines)

| 用途 | 構成 |
|---|---|
| Admin panel | 左 sidebar (nav) + top header + main content (table or detail) |
| Analytics dashboard | top filter bar + KPI cards row + 主要 chart + secondary chart grid |
| CRUD editor | top header (entity name + action) + left form + right preview |
| Marketplace | top search + grid card + sidebar filter |
| AI tool | left chat / center canvas / right inspector |

ただしこれは baseline、 task により dominant region は変わる (原則 16)。

## 数値 spec (推奨 default)

公式の具体数値は web-app では prompt に明記なし。 mobile-app / landing-page と比較して柔軟。
ただし以下は守る:

- sidebar 幅 240-320 px
- top header 高さ 56-64 px
- card padding 16-24 px
- card gap 12-16 px
- section gap 24-32 px

これは公式の他セクション (mobile / LP) から類推した baseline、 task の density mode (compact / medium / airy) で調整する。

## 完了基準

- 16 原則を全て満たす
- placeholder 全外し
- text fill 漏れなし
- export_image で視覚確認 OK
- table / form / card 等の構造が hierarchy に従う
