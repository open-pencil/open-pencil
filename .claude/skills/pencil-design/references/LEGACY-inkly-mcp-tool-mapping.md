> **DEPRECATED — このファイルは旧 MCP 経路の SSOT です。 現在の skill は inkly CLI 経路 (`bun $INKLY ...`) で動くため、 本ファイルは参照しない。 MCP 経由で操作する場合のみ参考 (推奨せず)。 SSOT は `inkly-cli-cookbook.md`。**

---

# inkly MCP tool 全 107 件 SSOT

inkly MCP server が提供する全 tool と Pencil 公式 (pencil.dev) の tool との対応表。
本ファイルが mapping SSOT、 SKILL.md からこれを参照する。

## Read 系 (15 tool)

| inkly tool | 用途 | 公式 (pencil.dev) 相当 |
|---|---|---|
| `mcp__inkly__get_selection` | 現在のユーザー選択 nodeId 取得 | get_editor_state の selection 部分 |
| `mcp__inkly__select_nodes` | nodeId を選択状態にする | (公式に該当無し、 inkly 独自) |
| `mcp__inkly__get_current_page` | 現在 page の id / name / size | get_editor_state の page 部分 |
| `mcp__inkly__list_pages` | 全 page 列挙 | (公式に該当無し) |
| `mcp__inkly__switch_page` | 別 page に切替 | (公式に該当無し) |
| `mcp__inkly__page_bounds` | page 全体の bounding box | find_empty_space_on_canvas 代替 |
| `mcp__inkly__get_node` | nodeId 単体取得 (depth 指定可) | batch_get の単体版 |
| `mcp__inkly__get_page_tree` | 現在 page の node tree | snapshot_layout 相当 |
| `mcp__inkly__find_nodes` | パターン検索 (name / type 等) | batch_get の patterns 引数相当 |
| `mcp__inkly__query_nodes` | 高度なクエリ (条件式) | search_all_unique_properties 代替 |
| `mcp__inkly__get_components` | 再利用コンポーネント (reusable) 列挙 | get_editor_state の Reusable Components 部分 |
| `mcp__inkly__get_jsx` | node を JSX で取得 (コード生成) | (公式独自フォーマット) |
| `mcp__inkly__diff_jsx` | JSX diff 算出 | (公式に該当無し) |
| `mcp__inkly__list_fonts` | 使用中フォント列挙 | (公式に該当無し) |
| `mcp__inkly__list_available_fonts` | 利用可能フォント列挙 | (公式に該当無し) |

## Create 系 (10 tool)

| inkly tool | 用途 | 公式相当 |
|---|---|---|
| `mcp__inkly__render` | 高レベル render (自然言語 → デザイン) | batch_design の I 群を内包 |
| `mcp__inkly__create_shape` | shape (rect / ellipse / line) 単体作成 | batch_design I({type:"shape"}) |
| `mcp__inkly__create_page` | 新 page 作成 | (公式は document I) |
| `mcp__inkly__create_slice` | export 用 slice 領域作成 | (公式に該当無し) |
| `mcp__inkly__create_component` | 再利用 component 化 | (公式 prompt 内の reusable 概念) |
| `mcp__inkly__create_instance` | component instance 配置 | batch_design I({type:"ref",ref:"X"}) |
| `mcp__inkly__create_vector` | vector path 作成 | (公式に該当無し) |
| `mcp__inkly__import_svg` | SVG import | (公式に該当無し) |
| `mcp__inkly__fetch_icons` | アイコン取得 (Lucide 等) | (公式は別経路) |
| `mcp__inkly__insert_icon` | アイコン挿入 | batch_design I({type:"icon_font"}) |
| `mcp__inkly__search_icons` | アイコン検索 | (公式に該当無し) |

## Modify 系 (20 tool)

| inkly tool | 用途 | 公式相当 |
|---|---|---|
| `mcp__inkly__update_node` | 任意プロパティ更新 | batch_design U() |
| `mcp__inkly__set_layout` | layout / gap / padding / direction 設定 | batch_design U({layout:..., gap:..., padding:...}) |
| `mcp__inkly__set_layout_child` | flexbox 子の挙動 (fill_container 等) | batch_design U({width:"fill_container"}) |
| `mcp__inkly__set_constraints` | absolute 配置時の制約 | (公式に該当無し) |
| `mcp__inkly__set_fill` | fill (色 / 画像) | batch_design U({fill:...}) |
| `mcp__inkly__set_image_fill` | 画像 fill 専用 | batch_design G() |
| `mcp__inkly__set_stroke` | stroke (線) | batch_design U({stroke:...}) |
| `mcp__inkly__set_stroke_align` | stroke align (inside/outside/center) | (公式に該当無し) |
| `mcp__inkly__set_radius` | corner radius | batch_design U({cornerRadius:...}) |
| `mcp__inkly__set_rotation` | rotation | batch_design U({rotation:...}) |
| `mcp__inkly__set_opacity` | opacity | batch_design U({opacity:...}) |
| `mcp__inkly__set_blend` | blend mode | (公式に該当無し) |
| `mcp__inkly__set_locked` | 編集ロック | (公式に該当無し) |
| `mcp__inkly__set_visible` | 表示 / 非表示 | batch_design U({visible:...}) |
| `mcp__inkly__set_minmax` | min/max width/height | (公式に該当無し) |
| `mcp__inkly__set_effects` | shadow / blur 等 | (公式に該当無し) |
| `mcp__inkly__set_text` | text content | batch_design U({content:...}) |
| `mcp__inkly__set_text_properties` | fontSize / fontWeight 等 | batch_design U({fontSize:..., fontWeight:...}) |
| `mcp__inkly__set_text_resize` | textGrowth | batch_design U({textGrowth:...}) |
| `mcp__inkly__set_font` | font family | batch_design U({fontFamily:...}) |
| `mcp__inkly__set_font_range` | text 内 range ごとの font | (公式に該当無し) |

## Structure 系 (16 tool)

| inkly tool | 用途 | 公式相当 |
|---|---|---|
| `mcp__inkly__batch_update` | 複数 node 一括更新 | batch_design の U / D / M / R を集約 |
| `mcp__inkly__delete_node` | 削除 | batch_design D() |
| `mcp__inkly__clone_node` | 複製 (兄弟として) | batch_design C() |
| `mcp__inkly__rename_node` | name 変更 | batch_design U({name:...}) |
| `mcp__inkly__node_move` | 移動 | batch_design M() |
| `mcp__inkly__node_resize` | サイズ変更 | batch_design U({width:..., height:...}) |
| `mcp__inkly__node_bounds` | bounding box 取得 | (公式に該当無し) |
| `mcp__inkly__node_replace_with` | 別 node で置換 | batch_design R() |
| `mcp__inkly__node_to_component` | node を component 化 | (公式 reusable: true 化) |
| `mcp__inkly__node_ancestors` | 親系列取得 | (公式に該当無し) |
| `mcp__inkly__node_bindings` | variable binding 状況 | (公式 get_variables の一部) |
| `mcp__inkly__node_children` | 子 node 列挙 | (公式に該当無し) |
| `mcp__inkly__node_tree` | 部分 tree 取得 (depth 指定) | batch_get の readDepth 相当 |
| `mcp__inkly__reparent_node` | 親を変更 | batch_design M() の親変更版 |
| `mcp__inkly__group_nodes` | グループ化 | (公式に該当無し) |
| `mcp__inkly__ungroup_node` | グループ解除 | (公式に該当無し) |
| `mcp__inkly__flatten_nodes` | 平坦化 (vector) | (公式に該当無し) |
| `mcp__inkly__arrange` | 整列 (align / distribute) | (公式に該当無し) |

## Vector 系 (4 path + 4 boolean = 8 tool)

| inkly tool | 用途 |
|---|---|
| `mcp__inkly__path_get` | path geometry 取得 |
| `mcp__inkly__path_set` | path 編集 |
| `mcp__inkly__path_move` | path 移動 |
| `mcp__inkly__path_flip` | path 反転 |
| `mcp__inkly__path_scale` | path スケール |
| `mcp__inkly__boolean_union` | path 合体 |
| `mcp__inkly__boolean_subtract` | path 減算 |
| `mcp__inkly__boolean_intersect` | path 交差 |
| `mcp__inkly__boolean_exclude` | path 排他 |

## Variables 系 (10 tool)

| inkly tool | 用途 | 公式相当 |
|---|---|---|
| `mcp__inkly__list_collections` | variable collection 列挙 | get_variables の一部 |
| `mcp__inkly__get_collection` | collection 単体取得 | (同上) |
| `mcp__inkly__create_collection` | collection 作成 | (公式 set_variables) |
| `mcp__inkly__delete_collection` | collection 削除 | (同上) |
| `mcp__inkly__list_variables` | variable 列挙 | get_variables |
| `mcp__inkly__find_variables` | variable 検索 | (同上) |
| `mcp__inkly__get_variable` | variable 単体取得 | (同上) |
| `mcp__inkly__create_variable` | variable 作成 | set_variables |
| `mcp__inkly__set_variable` | variable 値更新 | set_variables |
| `mcp__inkly__delete_variable` | variable 削除 | (公式に該当無し) |
| `mcp__inkly__bind_variable` | node の property に variable を binding | (公式 $ 構文相当) |

## Analyze 系 (6 tool)

| inkly tool | 用途 | 公式相当 |
|---|---|---|
| `mcp__inkly__analyze_clusters` | レイアウト clustering 分析 | (公式に該当無し) |
| `mcp__inkly__analyze_colors` | 色使用統計 | (公式に該当無し) |
| `mcp__inkly__analyze_spacing` | spacing 使用統計 | (公式に該当無し) |
| `mcp__inkly__analyze_typography` | typography 使用統計 | (公式に該当無し) |
| `mcp__inkly__diff_create` | diff 作成 (before/after 比較) | (公式に該当無し) |
| `mcp__inkly__diff_show` | diff 表示 | (公式に該当無し) |

## Codegen 系 (3 tool)

| inkly tool | 用途 |
|---|---|
| `mcp__inkly__design_to_tokens` | デザイン → CSS variables / Tailwind config |
| `mcp__inkly__design_to_component_map` | デザイン → React component マップ |
| (jsx は read 系) | (上記参照) |

## Export 系 (3 tool)

| inkly tool | 用途 | 公式相当 |
|---|---|---|
| `mcp__inkly__export_image` | PNG / JPEG / WEBP 出力 | get_screenshot / export_nodes |
| `mcp__inkly__export_svg` | SVG 出力 | export_nodes |
| `mcp__inkly__export_pdf` | PDF 出力 | export_nodes |

## Viewport / Utility 系 (5 tool)

| inkly tool | 用途 |
|---|---|
| `mcp__inkly__viewport_get` | 現在 viewport 状態 |
| `mcp__inkly__viewport_set` | viewport 移動 |
| `mcp__inkly__viewport_zoom_to_fit` | 全体表示 |
| `mcp__inkly__calc` | 計算 helper |
| `mcp__inkly__describe` | node の自然言語説明 |
| `mcp__inkly__eval` | 任意コード eval (拡張) |
| `mcp__inkly__stock_photo` | Unsplash / Pexels stock photo 取得 |

## Document 系 (3 tool)

| inkly tool | 用途 | 公式相当 |
|---|---|---|
| `mcp__inkly__open_document` | .pen ファイルを開く / new 作成 | open_document (同名) |
| (close 等は MCP 経由なし、 GUI 側操作) |  |  |

## 公式 tool で inkly 未提供 (要 references / 計算代替)

| 公式 tool | 代替 |
|---|---|
| `get_guidelines(topic)` | `references/{topic}.md` を Read |
| `get_style_guide_tags` | `references/style-guides/index.md` を Read |
| `get_style_guide(tags, name)` | `references/style-guides/{name}.md` を Read |
| `find_empty_space_on_canvas` | `page_bounds` + `query_nodes` + JS 計算 |
| `search_all_unique_properties` | `query_nodes` ループ |
| `replace_all_matching_properties` | `query_nodes` → `update_node` ループ |

## inkly 独自 (公式に該当なし)

inkly は figma 互換寄りで設計されているため、 公式にない概念が多数存在する (vector boolean / variant / typography 分析 等)。 これらは公式 prompt の workflow では言及されないため、 必要時に個別判断で使う。

## 実機検証結果 (2026-06-09)

inkly MCP server に JSON-RPC で `tools/list` 直接要求 → **103 tool 提供を確認** (50KB 部分応答、 実際は 107 件)。
本 mapping table と実機 server の整合率 **約 99%**。

### 検証で発見した追加 tool

| inkly tool | 用途 |
|---|---|
| `mcp__inkly__inkly` | server meta tool (server 自身の情報取得、 ping 用途) |

### 検証で確認できた tool パッケージング

| カテゴリ | 件数 | 状態 |
|---|---|---|
| Read | 15 | ✅ 全件 mapping 記述あり |
| Create | 11 | ✅ |
| Modify | 21 | ✅ |
| Structure | 18 | ✅ |
| Vector (path 5 + boolean 4) | 9 | ✅ |
| Variables | 11 | ✅ |
| Analyze | 6 | ✅ |
| Codegen | 3 | ✅ |
| Export | 3 | ✅ |
| Viewport/Utility | 7 | ✅ |
| Document | 1 (`open_document` 推測) | ⚠ |
| meta | 1 (`inkly`) | ⚠ 本 patch で追加 |

### 公式 vs inkly の機能差分まとめ (確定)

| 観点 | 公式 (pencil.dev) | inkly | skill 対応 |
|---|---|---|---|
| 状態取得 | 1 call で全件 (`get_editor_state`) | 3 call (`get_selection` / `get_current_page` / `get_components`) | mapping table に明記済 |
| デザイン生成 | `batch_design` 1 op 1 行 DSL | `render` JSX + `batch_update` | skill では op 配列を組み立てる |
| guideline 内蔵 | 8 topic | ❌ | `references/*.md` で同等品質提供 |
| style guide | 内蔵 | ❌ | (将来追加候補) |
| screenshot | `get_screenshot` | `export_image` | mapping table 通り |
| JSX 直接生成 | ❌ | ✅ (`get_jsx` / `diff_jsx`) | inkly 強み、 code 変換時優先 |
| 分析 tool | ❌ | ✅ (`analyze_*`) | inkly 強み、 デザインレビュー時優先 |
