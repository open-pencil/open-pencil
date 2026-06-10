# Tailwind v4 Implementation (公式移植)

Pencil 公式 `# Tailwind v4 Implementation Guidelines` セクションを忠実移植。
.pen → React/Tailwind コード生成時に適用。

## Core Principle

**Tailwind class を 100% 使う、 inline style は禁止** (sizing / color / spacing / typography 全て)。

## CSS Variables Setup

### globals.css 構造

```css
@import "tailwindcss";

:root {
  /* design variable from .pen — single value のみ */
  --color-primary: #3b82f6;
  --color-secondary: #8b5cf6;
  --spacing-base: 16px;
  /* DO NOT store font stack here */
}

@layer base {
  html, body {
    height: 100%;
  }
  /* Font family utility — font stack を直接定義 */
  .font-primary {
    font-family: "Inter", sans-serif;
  }
  .font-secondary {
    font-family: "JetBrains Mono", monospace;
  }
}
```

### Guidelines

- `get_variables` (inkly: `list_variables`) で design variable 読み込み
- single value (color / number / keyword) のみ `:root` に CSS custom property 化
- 全 design variable を design file の exact name で map
- **IMPORTANT** — `:root` を使う、 Tailwind v4 の `@theme` は custom property + `@keyframes` のみ対応
- manual reset 追加禁止 — `@import "tailwindcss";` で Preflight 自動 include
- **CRITICAL for Next.js** — `next/font` loader 使用時、 `--font-geist` 等の CSS variable を `:root` で re-wrap しない、 `@layer base` の utility class で直接 reference

## Font Implementation

### Core Rule

**CSS variable は single value のみ**。 font stack には使わない。

WRONG:
```css
:root {
  --font-primary: "Inter", sans-serif; /* ← font stack を CSS variable に入れない */
}
```

CORRECT:
```css
@layer base {
  .font-primary {
    font-family: "Inter", sans-serif;
  }
}
```

### Font Loading

`next/font/google` / `next/font/local` 使用時:
- CSS variable を re-wrap しない
- `@layer base` の utility class で `var(--font-XXX)` を直接 reference

### Icon Font

icon font は独立 utility class で `.icon` 等を定義、 各 icon は `<i className="icon icon-search" />` のような形。

### Viewport / Preflight / Tailwind v4 import

- viewport setting は HTML / Next.js metadata で
- preflight は `@import "tailwindcss";` で自動、 manual reset しない
- v4 では `@import "tailwindcss";` 使用、 v3 の `@tailwind base/components/utilities;` ではない

## Layout Conversion (.pen → Tailwind class)

| .pen property | Tailwind class |
|---|---|
| `layout: "vertical"` | `flex flex-col` |
| `layout: "horizontal"` | `flex flex-row` |
| `layout: "none"` | `relative` (子は `absolute`) |
| `gap: 16` | `gap-4` |
| `padding: 16` | `p-4` |
| `padding: [16, 24]` | `py-4 px-6` |
| `padding: [12, 24, 16, 24]` | `pt-3 pr-6 pb-4 pl-6` |
| `width: "fill_container"` | `w-full` または `flex-1` |
| `width: "fit_content"` | `w-fit` |
| `width: 200` | `w-[200px]` |
| `justifyContent: "center"` | `justify-center` |
| `alignItems: "center"` | `items-center` |
| `cornerRadius: 8` | `rounded-lg` |
| `cornerRadius: 36` | `rounded-[36px]` |

## Style Implementation

- design value を **exact match**、 必要なら arbitrary value (`w-[123px]`)
- color は CSS variable 経由 (`bg-[var(--color-primary)]` または `bg-primary` w/ tailwind config)
- hardcoded value 禁止

## SVG Styling

- SVG element に Tailwind class:
  - `fill="currentColor"` + 親に text color class
  - 直接 `fill-blue-500` 等は v4 で可
- stroke も同様

## SVG Path Implementation

design の SVG element を React に持ってくる時:

1. **Extract Exact Geometry**
   - `batch_get` with `includePathGeometry: true`
   - inkly では `mcp__inkly__path_get` で取得
   - **NEVER approximate** — exact `geometry` property を `<path d="...">` に
2. **Extract**:
   - `geometry` → `d` attribute
   - `fill` → CSS variable (`$primary` → `var(--primary)`)
   - `strokeColor` / `strokeThickness` (あれば)
   - `width` / `height` → viewBox
3. **Implement**:
   - exact geometry を `d` attribute に
   - `viewBox="0 0 {width} {height}"`
   - stroke property を preserve
4. **Logos / 複雑 icon**:
   - 長くても complete geometry を抽出
   - simplify / approximate しない
   - brand asset は precision 維持

## Component Implementation Workflow

### Step 1: Component Analysis and Extraction

1A. **Identify Required Components**
- target frame / design を read
- 該当 frame で使用される reusable component (ref) を identify
- 各 component の instance 数を count (missing instance 検知)
- Document: "Component X used N times"

1B. **Extract Component Definitions**
- inkly: `mcp__inkly__get_node({nodeId, depth: 3})`
- component を **1 つずつ** 処理: extract → React 化 → validate → 次

1C. **Map Component Instances**
- target frame structure を read
- 各 component の **全 instance** を identify
- 各 instance について document:
  - Instance ID / location
  - nested component override (`descendants` map)
  - props / value
- **Nested Component Analysis**:
  - base component definition で nested component が常に含まれるか?
  - 全 instance で override / hide があるか?
  - **Decision Rule**:
    - 全 instance で override away しない → 常に render (required)
    - 一部 instance で override away → conditional render (optional)
- **Visual Verification**:
  - inkly: `mcp__inkly__export_image({nodeId})` で instance in context 確認
  - 可視要素 (border / bg / shadow) 確認
  - styling が outer container か nested element か判定

### Step 2: React Component Creation

#### Component Structure
- `.tsx` を `src/components/` に作成 (component 名で)
- named export
- TypeScript interface で全 props を定義

#### Props Interface Design
- Step 1C mapping から全 instance の使用 property を抽出
- nested component rendering decision (required / optional) を適用
- instance mapping で完全性確認

#### Style Implementation
- Tailwind class 専用 (inline style 禁止)
- design value を exact match (必要なら arbitrary value)
- 色は CSS variable

### Step 3: Component Validation

1. **Visual Verification** — `export_image` で design vs React 比較、 pixel-perfect
2. **Style Verification** — computed CSS で dimension / spacing / color / typography 確認
3. **Behavior Verification** — fill_container 拡張 / fit_content 縮約 / overflow 確認
4. **Iterative Fixing** — 不一致は即 fix → re-validate

### Step 4: Frame Integration

- target frame を `maxDepth: 10` で read
- 各 instance の override を document
- parent container layout を確認 (flex 内複数 fill_container → 各 `flex-1`)
- Checklist:
  - [ ] 全 instance accounted for
  - [ ] 全 props が override 一致
  - [ ] nested component が required / optional 通り render
  - [ ] layout class (`flex-1` 等) 適用

### Step 5: Final Validation

- position / spacing が design match
- color が resolve
- typography match
- responsive (layout 適応 / scroll / overflow / fill_container 拡張)
- console error なし
- 全 interactive element 機能

## Key Principles

- styling system を consistent に使う (inline style 避ける)
- design value exact match
- project color system (CSS variable / design token / theme file) 使用、 hardcode 禁止
- component を 1 つずつ validate
- nested component rendering 要件を verify
- parent context に基づく styling

## 完了基準

- 全 component が Tailwind v4 syntax 準拠
- inline style 0 件
- design value exact match
- color が CSS variable 経由
- visual verification (pixel-perfect)
- responsive 全 breakpoint で機能
