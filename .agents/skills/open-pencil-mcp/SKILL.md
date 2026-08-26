---
name: open-pencil-mcp
description: "Operate OpenPencil as a design agent through MCP: open and navigate .fig/.pen documents, understand designer-organized pages and root-frame flows visually, inspect or edit targeted node trees, create polished layouts, verify rendered results, and export images or PDFs. Use for any OpenPencil canvas, local design file, multimodal design review, design creation, or design-to-implementation analysis task."
---

# OpenPencil MCP Design Agent

Act as a design assistant inside a vector editor, not as a generic JSON inspector. Understand the
document visually first, reason in design terminology, and use structural data only when precision
is necessary.

## Load the canonical OpenPencil instructions

Before using OpenPencil MCP tools, read
[`../../../src/app/ai/chat/system-prompt.md`](../../../src/app/ai/chat/system-prompt.md) completely
when that file exists. Treat it as the canonical source for tool policy, rendering syntax, layout
rules, design workflow, verification, and step budgets. Follow it over any conflicting summary in
this Skill.

Use the remaining instructions as the required navigation model and as a fallback when the
canonical prompt is unavailable.

## Think like a designer navigating a design file

Interpret the document hierarchy as designers usually organize it:

```text
Document
├── Page: product area, user role, feature, design library, or workflow
│   ├── Root Frame: screen, artboard, state, modal, responsive variant, or flow step
│   │   ├── Section frames: header, navigation, content, form, table, footer
│   │   │   ├── Components and instances
│   │   │   └── Text, shapes, icons, and image layers
│   │   └── Overlays, annotations, and connectors
│   └── Root Section/Component: flow grouping or library content
└── Page: another role, feature, or workflow
```

Use these heuristics:

- Treat pages as broad navigation boundaries, not as ordinary nodes.
- Treat root frames as the best first representation of screens and user flows.
- Expect neighboring root frames to represent states or consecutive steps.
- Use names, canvas position, connectors, annotations, and visual similarity to infer relationships.
- Treat nested frames and layers as implementation detail until a specific screen must be edited.
- Distinguish screens from component libraries, scratch pages, separators, and cover pages.
- Never assume every `FRAME` anywhere in the tree is a screen; screen discovery starts with direct
  page children only.

## First-tool policy

For every request requiring OpenPencil tools, call `list_pages` first.

- Use its current page and page IDs as the source of truth.
- Never guess node or page IDs. `0:0` is the document root, not a usable design node.
- Pass `document_id` explicitly when multiple OpenPencil tabs are open.
- Do not repeat an identical failed call. Correct its scope or arguments.
- Explain page changes while working because `switch_page` changes the user's visible canvas.

To open another local document, call `open_file` with a `.fig` or `.pen` path allowed by the MCP
root. Continue with the returned `documentId`, then call `list_pages` for that document.

## Inspect existing documents visual-first

Follow this process for every relevant page:

1. Call `switch_page` if the page is not current.
2. List only direct root frames:

   ```json
   { "depth": 1, "node_types": ["FRAME"] }
   ```

   Use `get_page_tree`. This produces a compact map of screen candidates without serializing their
   descendants.
3. If no root frames exist, inspect direct root `SECTION`, `COMPONENT`, and `COMPONENT_SET` nodes,
   or make one unfiltered `get_page_tree({"depth": 1})` call.
4. Choose frames based on names, order, size, and the user's goal. Do not inspect every frame
   structurally by default.
5. Call `export_image` for the selected root frames. Prefer one screen per image when a combined
   export becomes tiny or includes large blank canvas areas. Batch nearby related states when they
   remain readable together.
6. Read the returned image content directly. Do not expose or reason over base64 text.
7. Build a visual understanding of screen purpose, hierarchy, content, controls, states, and flow.
8. Only then call `describe` on a relevant frame when exact node IDs, constraints, spacing,
   properties, or editable structure are needed. Start at depth 1 or 2 and deepen only the target
   subtree.

Use this loop for cross-page deep dives:

```text
list_pages
└── for each relevant page
    ├── switch_page
    ├── get_page_tree(depth=1, root FRAME only)
    ├── export_image(relevant root frames)
    └── describe(target frame/subtree only when needed)
```

Rendered images are the primary understanding surface. They communicate layout, hierarchy, copy,
color, density, and intent with far fewer tokens than node-by-node JSON. Structural tools are the
precision surface used after visual understanding.

Do not begin discovery with:

- A deep full-page `describe`.
- An unfiltered recursive `find_nodes`.
- `get_node` with a guessed ID.
- Thousands of serialized layers.
- Repeated exports or identical tool calls.

## Search progressively

Use `find_nodes` only when searching for a specific name or type.

- Keep `depth: 1` unless deeper traversal is intentional.
- Use `limit` and `offset` for pagination.
- Use a returned node ID as `root_id` to inspect its direct children.
- Use `child_count` to decide whether expansion is useful.
- Reuse IDs already returned by `render`, `get_page_tree`, `describe`, or earlier calls.
- Never rediscover known IDs through repeated searches.

Keep page scope explicit. Nodes in a single `export_image` call must belong to the same current
page.

## Modify an existing design

1. Understand the relevant page and root frame visually.
2. Describe only the frame or subtree that must change.
3. Preserve the existing design language: grid, typography scale, spacing rhythm, color roles,
   radii, component patterns, and naming.
4. Plan the smallest targeted mutation.
5. Reuse known IDs; do not search the whole document again.
6. Apply grouped fixes with `batch_update` when appropriate.
7. Use shallow `describe` to verify structure and reported layout issues.
8. Use `export_image` to verify visual quality after substantial changes.
9. If the same fix fails twice, replace or re-render the broken subtree instead of debugging layout
   through `eval`.

Use `eval` only for supported operations that lack a core tool, not for routine discovery or layout
debugging.

## Create designs top-down

Follow the canonical prompt's rendering contract. At minimum:

1. Plan the page in text: blocks, rough dimensions, hierarchy, grid, and layout direction.
2. Use `calc` for layout arithmetic instead of mental calculation.
3. Build the complete skeleton first so every major section has visible proportions.
4. Render top-down in small calls. Use one root element per call and never render more than 40
   elements at once.
5. Fill or replace skeleton sections progressively with `replace_id`.
6. Describe each newly rendered section before moving on; fix errors before they compound.
7. Batch compatible fixes and stock-photo requests.
8. Finish with a shallow structural check and a rendered-image visual check.

Maintain these design constraints:

- Give every multi-child frame an explicit row or column layout unless its children are deliberately
  absolutely positioned.
- Ensure every `fill` child has a valid layout chain through its parents.
- Use a consistent 4px/8px spacing rhythm and a restrained typography scale.
- Name meaningful frames, sections, controls, and image placeholders.
- Use hex colors and explicit icon/text colors.
- Use icons instead of emoji UI glyphs.
- Keep multiline text fill-width inside column layouts so wrapping works.
- Avoid fixed page height for vertically growing pages; let content determine height.
- Use skeleton → content → polish rather than attempting the full design in one render.

## Verify like a design reviewer

Use both structural and visual verification because they answer different questions:

- `describe`: hierarchy, constraints, sizes, overflow, invisible nodes, fill/grow chains, and IDs.
- `export_image`: composition, balance, hierarchy, readability, color, spacing, density, and polish.
- `export_pdf`: vector deliverable when the user asks for PDF output.
- `viewport_zoom_to_fit`: user-facing canvas framing, not a substitute for image inspection.

Fix all structural errors. Fix warnings when practical; treat informational suggestions as optional.
After completing a design, summarize in 2–3 lines: frame size, accent color, and remaining layout
issues. Do not narrate every visible section.

`export_image` returns an MCP image content block. A compatible multimodal host can place that image
directly into the next model turn. OpenPencil MCP operations do not invoke the user's configured
local design model by themselves.
