# Design System (公式 Pencil Design — Design Workflow + Design System Composition 移植)

公式 `# Pencil Design — Design Workflow` と `get_guidelines("design-system")` を統合移植。
既存 component library を使った screen / dashboard 構築に適用。

## 1. Core Principles

- visual verification 必須 — `export_image` で correctness 確認
- component hierarchy に従う — parent-child 関係
- design system を尊重 — 既存 variable / pattern 使う
- 1 batch_update 最大 **25 operation**、 大型は section で分割
- copy + descendant 修正 — Copy operation の "descendants" property を使う、 copy 後の descendant に個別 Update は ID mismatch で fail する
- instance descendant 修正:
  - property change → `U(instance+"/childId", {...})`
  - 完全 swap → `R(instance+"/childId", {...})`
  - frame に children 追加 → `I()`
- **IMPORTANT** — copy (C) した node の descendant を Update (U) しない、 copy は descendant を recreate して新 ID を振る

## 2. Common Component Naming

design system にあり得る命名 pattern:

| パターン | 例 |
|---|---|
| `Button/*` | Button variants (Primary / Secondary / Outline / Ghost / Destructive) |
| `Input/*` / `Input Group/*` | Form inputs |
| `Card` | Card containers |
| `Sidebar` | Navigation sidebar |
| `Table` / `Data Table` | Table elements |
| `Alert/*` | Feedback alerts |
| `Modal/*` / `Dialog` | Modal dialogs |

`get_components` (inkly: `bun $INKLY find <file> --type COMPONENT`) で実際の component を列挙してから使う。

## 3. Slots (重要)

slot = component 内の placeholder frame、 子 component を差し込む箇所。
`slot` property に recommended component ID 配列を持つ。

### Slot 識別

component を read したら以下のような構造を探す:

```json
{
  "id": "slotId",
  "name": "Content Slot",
  "slot": ["recommendedComponentId1", "recommendedComponentId2"]
}
```

### Slot 使用パターン

```
1. parent component を insert → binding 取得
2. slot path = parentBinding + "/" + slotId
3. その path に子 component を insert
4. slot の recommended component を優先 (他も入れられる)
```

例 — sidebar に navigation item を入れる:

```
sidebar=I(page, {type:"ref", ref:"sidebarComponentId", height:"fill_container"})
item1=I(sidebar+"/contentSlotId", {type:"ref", ref:"sidebarItemId", descendants:{...}})
item2=I(sidebar+"/contentSlotId", {type:"ref", ref:"sidebarItemId", descendants:{...}})
```

不要な slot は `enabled: false` で hide:

```
U(card+"/actionsSlotId", {enabled: false})
```

## 4. Icons

### Available Icon Sets

`icon_font` type で以下が使える:

| Font Family | Style | Example |
|---|---|---|
| `lucide` | Outline / rounded | `home`, `settings`, `user`, `search`, `plus`, `x` |
| `feather` | Outline / rounded | 同上 |
| `Material Symbols Outlined` | Outline | `home`, `settings`, `person`, `search`, `add`, `close` |
| `Material Symbols Rounded` | Rounded | 同上 |
| `Material Symbols Sharp` | Sharp corners | 同上 |

### Icon Usage 構文

```
icon=I(container, {type:"icon_font", iconFontFamily:"lucide", iconFontName:"settings", width:24, height:24, fill:"$--foreground"})
icon=I(container, {type:"icon_font", iconFontFamily:"Material Symbols Rounded", iconFontName:"dashboard", width:24, height:24, fill:"$--foreground", weight:400})
```

icon は **width / height 必須** (textGrowth 不要)。

### Component 内 icon の override

```
descendants: {"iconNodeId": {iconFontName: "settings"}}
```

### Common Icon Names 対応表

| Action | Lucide/Feather | Material Symbols |
|---|---|---|
| Home | `home` | `home` |
| Settings | `settings` | `settings` |
| User | `user` | `person` |
| Search | `search` | `search` |
| Add | `plus` | `add` |
| Close | `x` | `close` |
| Edit | `edit` / `pencil` | `edit` |
| Delete | `trash` / `trash-2` | `delete` |
| Check | `check` | `check` |
| Arrow right | `arrow-right` | `arrow_forward` |
| Chevron down | `chevron-down` | `expand_more` |
| Menu | `menu` | `menu` |
| Dashboard | `layout-dashboard` | `dashboard` |
| Folder | `folder` | `folder` |
| File | `file` | `description` |
| Calendar | `calendar` | `calendar_today` |
| Mail | `mail` | `mail` |
| Bell | `bell` | `notifications` |

## 5. Sidebar Composition

### 構造

```
Sidebar Component
├── Header (logo / brand)
├── Content Slot ← navigation item をここに insert
└── Footer (user profile / settings)
```

### 構築例

```
sidebar=I(page, {type:"ref", ref:"sidebarId", height:"fill_container"})
sectionTitle=I(sidebar+"/contentSlotId", {type:"ref", ref:"sidebarSectionTitleId", descendants:{"labelTextId":{content:"Main Menu"}}})
itemDashboard=I(sidebar+"/contentSlotId", {type:"ref", ref:"sidebarItemActiveId", descendants:{"iconId":{iconFontName:"dashboard"}, "labelId":{content:"Dashboard"}}})
itemUsers=I(sidebar+"/contentSlotId", {type:"ref", ref:"sidebarItemDefaultId", descendants:{"iconId":{iconFontName:"users"}, "labelId":{content:"Users"}}})
itemSettings=I(sidebar+"/contentSlotId", {type:"ref", ref:"sidebarItemDefaultId", descendants:{"iconId":{iconFontName:"settings"}, "labelId":{content:"Settings"}}})
```

## 6. Card Composition

### 構造 (典型 3 slot)

```
Card Component
├── Header Slot ← Title / description
├── Content Slot ← Main content
└── Actions Slot ← Buttons
```

### 構築例

```
card=I(container, {type:"ref", ref:"cardId", width:480})
R(card+"/headerSlotId", {type:"frame", layout:"vertical", gap:4, padding:24, width:"fill_container", children:[
  {type:"text", content:"Card Title", fill:"$--foreground", fontFamily:"$--font-primary", fontSize:18, fontWeight:"600"},
  {type:"text", content:"Card description goes here", fill:"$--muted-foreground", fontFamily:"$--font-secondary", fontSize:14}
]})
U(card+"/contentSlotId", {layout:"vertical", gap:16, padding:24})
input=I(card+"/contentSlotId", {type:"ref", ref:"inputGroupId", width:"fill_container", descendants:{"labelId":{content:"Email"}}})
U(card+"/actionsSlotId", {gap:12, justifyContent:"end", padding:24})
cancelBtn=I(card+"/actionsSlotId", {type:"ref", ref:"buttonOutlineId", descendants:{"iconId":{enabled:false}, "labelId":{content:"Cancel"}}})
saveBtn=I(card+"/actionsSlotId", {type:"ref", ref:"buttonPrimaryId", descendants:{"iconId":{enabled:false}, "labelId":{content:"Save"}}})
```

## 7. Tab Composition

```
Tabs Container
└── Direct children: Tab Items (active / inactive)
```

```
tabs=I(container, {type:"ref", ref:"tabsId", width:"fit_content"})
tab1=I(tabs, {type:"ref", ref:"tabItemActiveId", descendants:{"labelId":{content:"General"}}})
tab2=I(tabs, {type:"ref", ref:"tabItemInactiveId", descendants:{"labelId":{content:"Security"}}})
tab3=I(tabs, {type:"ref", ref:"tabItemInactiveId", descendants:{"labelId":{content:"Billing"}}})
```

## 8. Dropdown Composition

```
Dropdown Container
└── Direct children: Search / Dividers / Titles / List Items
```

```
dropdown=I(container, {type:"ref", ref:"dropdownId", height:"fit_content"})
search=I(dropdown, {type:"ref", ref:"searchBoxId"})
divider=I(dropdown, {type:"ref", ref:"listDividerId"})
title=I(dropdown, {type:"ref", ref:"listTitleId", descendants:{"labelId":{content:"Actions"}}})
optionA=I(dropdown, {type:"ref", ref:"listItemCheckedId", descendants:{"labelId":{content:"Option A"}}})
optionB=I(dropdown, {type:"ref", ref:"listItemUncheckedId", descendants:{"labelId":{content:"Option B"}}})
```

## 9. Table Composition (full 仕様)

### 構造

```
Table (frame)
├── Table Header — Search/filter + action buttons
├── Table Wrapper — 全 row を内包
│   ├── Header Row (frame)
│   │   └── Cell (frame)
│   │       └── Content (text / label / button etc.)
│   ├── Data Row 1 (frame)
│   │   └── Cell (frame)
│   │       └── Content
│   └── ...
└── Table Footer — Row count + pagination
```

### Hierarchy (絶対)

**Table → Row → Cell (frame) → Cell Content**

- **Table** — vertical layout で全 row 内包
- **Row** — horizontal layout で cell 内包
- **Cell** — column 幅を制御する frame wrapper
- **Cell Content** — text / badge / button 等

### Data Row 構築例

複数 row は多 batch_update に分割 (2-3 row / call)。

```
row1=I(table, {type:"ref", ref:"dataTableRowId", width:"fill_container"})
nameCell=I(row1, {type:"ref", ref:"dataTableCellId", width:"fill_container"})
nameText=I(nameCell, {type:"text", content:"John Doe"})
emailCell=I(row1, {type:"ref", ref:"dataTableCellId", width:"fill_container"})
emailText=I(emailCell, {type:"text", content:"john@example.com"})
statusCell=I(row1, {type:"ref", ref:"dataTableCellId", width:120})
statusBadge=I(statusCell, {type:"ref", ref:"labelSuccessId", descendants:{"textId":{content:"Active"}}})
actionsCell=I(row1, {type:"ref", ref:"dataTableCellId", width:100})
actionBtn=I(actionsCell, {type:"ref", ref:"iconButtonId"})
```

### Column Width 推奨

| Column Type | Width |
|---|---|
| Primary identifier (name) | 200-250 px |
| Email / URL | `fill_container` |
| Status / badge | 100-120 px |
| Date | 120-150 px |
| Actions | 80-100 px |
| Numbers | 80-100 px |

## 10. Pagination Composition

```
Pagination Component
├── Previous Button
├── Page Numbers Slot ← page item を insert
└── Next Button
```

```
pagination=I(container, {type:"ref", ref:"paginationId"})
page1=I(pagination+"/pageNumbersSlotId", {type:"ref", ref:"paginationItemActiveId", descendants:{"labelId":{content:"1"}}})
page2=I(pagination+"/pageNumbersSlotId", {type:"ref", ref:"paginationItemDefaultId", descendants:{"labelId":{content:"2"}}})
page3=I(pagination+"/pageNumbersSlotId", {type:"ref", ref:"paginationItemDefaultId", descendants:{"labelId":{content:"3"}}})
ellipsis=I(pagination+"/pageNumbersSlotId", {type:"ref", ref:"paginationItemEllipsisId"})
page10=I(pagination+"/pageNumbersSlotId", {type:"ref", ref:"paginationItemDefaultId", descendants:{"labelId":{content:"10"}}})
```

## 11. Screen Layout Patterns

### Pattern A: Sidebar + Content (Dashboard)

```
┌──────────┬────────────────────────────────┐
│          │                                │
│ Sidebar  │     Main Content Area          │
│  280px   │      fill_container            │
│          │                                │
└──────────┴────────────────────────────────┘
```

```
screen=I(document, {type:"frame", name:"Dashboard", layout:"horizontal", width:1440, height:"fit_content(900)", fill:"$--background", placeholder:true})
sidebar=I(screen, {type:"ref", ref:"sidebarId", height:"fill_container"})
main=I(screen, {type:"frame", layout:"vertical", width:"fill_container", height:"fill_container(900)", padding:32, gap:24})
```

### Pattern B: Header + Content

```
┌────────────────────────────────────────────┐
│              Header Bar (64px)             │
├────────────────────────────────────────────┤
│            Content Area                    │
└────────────────────────────────────────────┘
```

```
screen=I(document, {type:"frame", layout:"vertical", width:1200, height:"fit_content(800)", fill:"$--background", placeholder:true})
header=I(screen, {type:"frame", layout:"horizontal", width:"fill_container", height:64, padding:[0,24], alignItems:"center", justifyContent:"space_between", stroke:{align:"inside", fill:"$--border", thickness:{bottom:1}}})
content=I(screen, {type:"frame", layout:"vertical", width:"fill_container", height:"fit_content(736)", padding:32, gap:24})
```

### Pattern C: Two-Column Layout (2/3 + 1/3)

```
┌─────────────────────┬─────────────┐
│    Main (2/3)       │  Side (1/3) │
│   fill_container    │   360px     │
└─────────────────────┴─────────────┘
```

```
columns=I(content, {type:"frame", layout:"horizontal", width:"fill_container", height:"fill_container(900)", gap:24})
mainCol=I(columns, {type:"frame", layout:"vertical", width:"fill_container", height:"fit_content(900)", gap:24})
sideCol=I(columns, {type:"frame", layout:"vertical", width:360, height:"fit_content(900)", gap:24})
```

### Pattern D: Card Grid

```
┌──────────┐ ┌──────────┐ ┌──────────┐
│  Card 1  │ │  Card 2  │ │  Card 3  │
└──────────┘ └──────────┘ └──────────┘
```

```
cardGrid=I(container, {type:"frame", layout:"horizontal", width:"fill_container", gap:16})
card1=I(cardGrid, {type:"ref", ref:"cardId", width:"fill_container"})
card2=I(cardGrid, {type:"ref", ref:"cardId", width:"fill_container"})
card3=I(cardGrid, {type:"ref", ref:"cardId", width:"fill_container"})
```

## 12. Common Compositions

### Page Header with Breadcrumbs + Actions

```
pageHeader=I(main, {type:"frame", layout:"horizontal", width:"fill_container", justifyContent:"space_between", alignItems:"center"})
breadcrumbs=I(pageHeader, {type:"frame", layout:"horizontal", gap:0, alignItems:"center"})
crumb1=I(breadcrumbs, {type:"ref", ref:"breadcrumbItemId", descendants:{"labelId":{content:"Dashboard"}}})
sep=I(breadcrumbs, {type:"ref", ref:"breadcrumbSeparatorId"})
crumb2=I(breadcrumbs, {type:"ref", ref:"breadcrumbItemActiveId", descendants:{"labelId":{content:"Users"}}})
actions=I(pageHeader, {type:"frame", layout:"horizontal", gap:12})
exportBtn=I(actions, {type:"ref", ref:"buttonOutlineId", descendants:{"iconId":{enabled:false}, "labelId":{content:"Export"}}})
addBtn=I(actions, {type:"ref", ref:"buttonPrimaryId", descendants:{"iconId":{enabled:false}, "labelId":{content:"Add User"}}})
```

### Form Layout

```
card=I(container, {type:"ref", ref:"cardId", width:"fill_container"})
form=I(card+"/contentSlotId", {type:"frame", layout:"vertical", gap:16, width:"fill_container"})
row=I(form, {type:"frame", layout:"horizontal", gap:16, width:"fill_container"})
firstName=I(row, {type:"ref", ref:"inputGroupId", width:"fill_container", descendants:{"labelId":{content:"First Name"}}})
lastName=I(row, {type:"ref", ref:"inputGroupId", width:"fill_container", descendants:{"labelId":{content:"Last Name"}}})
email=I(form, {type:"ref", ref:"inputGroupId", width:"fill_container", descendants:{"labelId":{content:"Email"}}})
message=I(form, {type:"ref", ref:"textareaGroupId", width:"fill_container", descendants:{"labelId":{content:"Message"}}})
```

### Metric Cards

```
metrics=I(content, {type:"frame", layout:"horizontal", gap:16, width:"fill_container"})
metric1=I(metrics, {type:"ref", ref:"cardId", width:"fill_container"})
R(metric1+"/headerSlotId", {type:"frame", layout:"vertical", gap:4, padding:24, width:"fill_container", children:[
  {type:"text", content:"Total Users", fill:"$--muted-foreground", fontFamily:"$--font-secondary", fontSize:14},
  {type:"text", content:"12,543", fill:"$--foreground", fontFamily:"$--font-primary", fontSize:32, fontWeight:"600"}
]})
U(metric1+"/contentSlotId", {enabled:false})
U(metric1+"/actionsSlotId", {enabled:false})
```

## 13. Spacing Reference (公式表 SSOT)

| Context | Gap | Padding |
|---|---|---|
| Screen sections | 24-32 | — |
| Card grid | 16-24 | — |
| Form fields (vertical) | 16 | — |
| Form row (horizontal) | 16 | — |
| Button groups | 12 | — |
| Inside cards | — | 24 |
| Inside buttons | — | [10, 16] |
| Inside inputs | — | [8, 16] |
| Page content area | — | 32 |
| Sidebar items | 0 | [12, 16] |

## 14. Button Hierarchy

1 section 1 primary action が原則。

| Priority | Variant | 用途 |
|---|---|---|
| 1 | Primary / Default | Main action (Save / Submit / Create) |
| 2 | Secondary | Alternative action |
| 3 | Outline | Tertiary / Cancel / Back |
| 4 | Ghost | Inline action / navigation |
| 5 | Destructive | Delete / Remove |

### Button Actions Alignment

| Context | Alignment |
|---|---|
| Cards / Modals | Right (`justifyContent:"end"`) |
| Forms | submit button right-align |
| Toolbars | primary left / secondary right |
| Destructive + Cancel | Cancel left / Destructive right |

## 15. Design Tokens 対応表

### Colors

| Token | Usage |
|---|---|
| `$--background` | Page background |
| `$--foreground` | Primary text |
| `$--muted-foreground` | Secondary text / placeholder |
| `$--card` | Card background |
| `$--border` | Border / divider |
| `$--primary` | Primary action / brand |
| `$--secondary` | Secondary element |
| `$--destructive` | Danger action |

### Semantic Colors

| State | Background | Foreground |
|---|---|---|
| Success | `$--color-success` | `$--color-success-foreground` |
| Warning | `$--color-warning` | `$--color-warning-foreground` |
| Error | `$--color-error` | `$--color-error-foreground` |
| Info | `$--color-info` | `$--color-info-foreground` |

### Typography

| Token | Usage |
|---|---|
| `$--font-primary` | Headings / labels / navigation |
| `$--font-secondary` | Body text / descriptions / inputs |

### Border Radius

| Token | Usage |
|---|---|
| `$--radius-none` | Tables / sharp container |
| `$--radius-m` | Cards / modals |
| `$--radius-pill` | Buttons / inputs / badges |

## 16. Workflow (公式 §1-8)

1. **get_editor_state** (inkly: `get_selection` + `get_current_page` + `get_components`) — 現在 .pen / selection / reusable list
2. **DECISION POINT** — Creative (A) vs Compositional (B)
   - A: `get_style_guide_tags` → `get_style_guide` → `get_guidelines("XXX")` (= references/{topic}.md Read)
   - B: `get_guidelines("design-system")` (= 本 file) のみ Read
3. **get_variables** (inkly: `list_variables`) — design token 取得、 hardcode 禁止
4. **batch_get(componentIds, readDepth:3)** (inkly: `get_node({nodeId, depth:3})`) — component 構造 inspect
5. **snapshot_layout(parentId, maxDepth:N)** (inkly: `get_page_tree({maxDepth:N})`) — 既存 layout 確認
6. **batch_design()** (inkly: `batch_update` / 個別 tool) — 生成 (25 op cap)
7. **get_screenshot(nodeId)** (inkly: `export_image`) — 視覚検証
8. step 6-7 を section ごとに反復

## 17. Grounding Rules

- component list は `get_editor_state` で取得、 個別読みは `batch_get` で必要なものだけ
- major design operation 後は `get_screenshot` で verify
- 既存 component を優先、 custom frame を作る前に既存を確認

## 18. Design Principles

### Visual Hierarchy
- 1 section に focal point 1 つ
- size / weight / color で重要度を establish
- primary action は visually dominant

### Alignment & Grid
- implicit grid に沿って align
- container 内で edge alignment を consistent に
- orphaned / floating element 避ける

### Spacing Consistency
- 既存 gap / padding を使う、 arbitrary mix 禁止
- vertical rhythm を section 間で consistent に

### Color Usage
- 常に `$--variable` token 使う、 hex/rgb hardcode 禁止
- text readability の contrast 確保
- semantic color を意図通りに使う

### Content Density
- 詰め込まない、 breathing room 確保
- card は 1 primary idea
- table 列数は 4-7 を推奨

## 完了基準

- 全 reusable component が token (variable) 参照
- hardcode 値なし
- nested component の required / optional 整合
- placeholder 全外し
- export_image で visual verify 済
- spacing reference table に従う
- button hierarchy に従う
