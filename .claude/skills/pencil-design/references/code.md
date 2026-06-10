# Code Generation (.pen → コード) — 公式 `get_guidelines("code")` 移植

.pen file からコード生成するときの全般指針。 framework / styling 個別の詳細は `tailwind.md` 参照。

## 大原則

- **既存 framework を使う** — project が React なら React、 Vue なら Vue、 Svelte なら Svelte
- **既存 CSS lib / design system を leverage** — Tailwind / CSS Modules / styled-components 等、 project に既にあるものを使う
- **CSS lib version を identify** — Tailwind v3 か v4 か等を確認し対応 API を使う
- **design の text label / icon / spacing を exact match** — 「だいたい」で済ませない
- **コード生成だけ出力** — Markdown documentation を生成しない (`DO NOT create documentations`)
- **既存コードを探す** — design element が既に codebase にあるか workspace を探索、 あれば update、 なければ新規
- **font / icon / border radius を正確に** — 数値・名前を design と完全一致
- **frontend framework / UI lib 不明なら workspace 探索** — package.json / config を読む
- **既存 component を update**、 新規生成しない (重複作らない)
- **既存 component 修正時は functionality を壊さない** — props / behavior を維持

## Initial Setup

### Project Initialization

1. frontend framework / language identify (React / Vue / Angular / Svelte 等)
2. 既存 framework / language / convention を使う
3. styling approach identify (Tailwind / CSS Modules / styled-components 等)
4. Tailwind なら `tailwind.md` 参照

### Pre-Implementation Verification

- CSS / style が error なく compile するか確認
- CSS variable が全 access 可能か (custom property 使用時)
- styling system が properly load されているか確認

## Component Implementation Workflow

### Step 1: Component Analysis and Extraction

#### 1A. Required Component Identify

- target frame / design を read
- 該当 frame で使われる reusable component (ref) を identify
- **IMPORTANT** — current frame に出る component **のみ** 処理
- 各 component の instance 数 count (missing 検知)
- Document: "Component X used N times"

#### 1B. Component Definition Extract

- `batch_get` で component 構造を取得 (inkly: `get_node({nodeId, depth: 3})`)
- nested children も含めて full tree extract
- component を **1 つずつ** 処理:
  1. full depth で extract
  2. React (or 他 framework) で recreate (Step 2)
  3. validate (Step 3)
  4. 次へ進むのは validation pass 後

#### 1C. Instance Mapping

- target frame structure を read
- 各 component の **全 instance** を identify
- 各 instance について document:
  - Instance ID / location
  - nested component override (`descendants` map)
  - props / value
- **Nested Component Analysis**:
  - base definition で nested component が常に含まれるか?
  - 全 instance で override / hide があるか?
  - **Decision Rule**:
    - 全 instance で override away しない → required (常に render)
    - 一部 instance で override away → optional (conditional render)
- **Visual Verification**:
  - `get_screenshot` (inkly: `export_image`) を **instance in context** で
  - border / bg / shadow 等の可視要素確認
  - styling が outer container か nested element か判定

### Step 2: React Component Creation

#### Component Structure

- `.tsx` を `src/components/` に作成 (component 名)
- **named export**
- TypeScript interface で全 props を定義

#### Props Interface Design

- Step 1C mapping から全 instance の使用 property を抽出
- 全 property をサポート (optional 含む)
- **Nested Component Rendering**:
  - Step 1C decision rule を適用
  - 全 instance override away しない → 常に render (required)
  - 一部 instance override away → conditional render (optional)
- required / optional を actual usage で document
- instance mapping で完全性 cross-reference

#### Style Implementation

- **Tailwind class 専用** (inline style 禁止)
- `tailwind.md` の "Layout Conversion" / "Style Implementation" / "CSS Custom Properties and Font Stacks" 参照
- design value を **exact match** (必要なら arbitrary value `w-[123px]`)
- color は CSS variable (hardcode 禁止)

#### SVG Path Implementation

design の SVG element を React に持ってくる時:

1. **Extract Exact Geometry**
   - `batch_get` with `includePathGeometry: true` (inkly: `mcp__inkly__path_get`)
   - **NEVER approximate** — exact `geometry` を `<path d="...">` に

2. **Extract**:
   - `geometry` → `d` attribute
   - `fill` → CSS variable (`$primary` → `var(--primary)`)
   - `strokeColor` / `strokeThickness` (あれば)
   - `width` / `height` → viewBox

3. **Implement**:
   - exact geometry を `d` に
   - `viewBox="0 0 {width} {height}"`
   - stroke property preserve
   - styling は `tailwind.md` "SVG Styling" 参照

4. **Logos / 複雑 icon**:
   - 長くても complete geometry 抽出
   - simplify / approximate しない
   - brand asset は precision 維持

### Step 3: Component Validation

1. **Visual Verification** — `export_image` で design vs React 比較、 pixel-perfect
2. **Style Verification** — computed CSS で dimension / spacing / color / typography 確認、 CSS variable resolve 確認
3. **Behavior Verification** — fill_container 拡張 / fit_content 縮約 / overflow 無し確認
4. **Iterative Fixing** — 即 fix → re-validate、 current が perfect になるまで次へ進まない

### Step 4: Frame Integration

#### Pre-Integration Analysis

- target frame を `maxDepth: 10` で read
- component tree map
- 全 component instance identify

#### Instance Configuration

- 各 instance の property override を document
- nested component override 確認
- exact props で instance mapping 作成
- **Layout Context**:
  - parent container layout mode 確認
  - flex container で複数 `fill_container` 子 → 各 `flex-1`
  - parent layout で `flex-1` 必要 component を document

#### Completeness Verification

- design vs implementation の instance 数 count
- 全 props が design override 一致
- nested component が required / optional 通り
- Checklist:
  - [ ] 全 instance accounted for
  - [ ] 全 props が override 一致
  - [ ] nested component が required / optional 通り render
  - [ ] layout class (`flex-1` 等) 適用

### Step 5: Final Validation

- position / spacing が design match
- color が resolve
- typography match
- responsive (layout 適応 / scroll / overflow / fill_container 拡張 / fit_content 縮約)
- console error なし
- 全 interactive element 機能

## Key Principles

- project styling system を consistent に使う (inline style 避ける)
- Tailwind 使用時は `tailwind.md` 参照
- design value exact match
- project color system (CSS variable / design token / theme file) 使用、 hardcode 禁止
- component を 1 つずつ validate
- nested component rendering 要件 verify
- parent context に基づく styling

## inkly tool 経由での実装

| 公式 (code workflow) | inkly equivalent |
|---|---|
| `batch_get` (component 構造) | `mcp__inkly__get_node({nodeId, depth: N})` または `node_tree` |
| `batch_get(includePathGeometry: true)` | `mcp__inkly__path_get` |
| `get_screenshot` (visual verify) | `mcp__inkly__export_image({nodeId, format: "png"})` |
| `get_variables` (CSS variable 抽出) | `bun $INKLY variables <file>` |
| `get_jsx` (JSX 直接生成) | `mcp__inkly__get_jsx` (inkly 独自、 完全 JSX 出力) |
| `diff_jsx` | `mcp__inkly__diff_jsx` |

inkly では `get_jsx` を使うと JSX を直接生成できる (公式にない便利機能)、 これを起点に編集する経路が最短。

## 完了基準

- 既存 framework と一致
- inline style 0 件 (Tailwind 等の class 専用)
- design value exact match
- CSS variable 経由 (hardcode 禁止)
- pixel-perfect (visual verify 済)
- responsive 全 breakpoint 機能
- console error 0
- 全 interactive element 機能
- documentation Markdown 生成していない
