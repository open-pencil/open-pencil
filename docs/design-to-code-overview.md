# Design → Code Pipeline: Overview

## Goal

Take a .fig design and produce production-ready code on the user's target stack (React, Vue, Svelte, etc. + Tailwind/CSS Modules/etc.) via AI-assisted code generation through the MCP server.

## Current State

### What exists (extraction layer)

| Capability | Tool/Module | Output |
|-----------|-------------|--------|
| Read node tree | `get_page_tree`, `get_node`, `find_nodes`, `query_nodes` | JSON node properties |
| Semantic analysis | `describe` | Role, layout, visual style, issues |
| JSX representation | `get_jsx` | OpenPencil JSX (`<Frame flex="col" w={320}>`) |
| Tailwind JSX | `export-jsx.ts` (tailwind format) | `<div className="flex flex-col w-80">` |
| SVG export | `export_svg` | SVG markup string |
| Image export | `export_image` | PNG/JPG/WEBP raster |
| Components list | `get_components` | Component IDs, names, pages |
| Design tokens | `list_variables`, `find_variables`, `list_collections` | Variable names, types, values, modes |
| Color analysis | `analyze_colors` | Palette, frequencies, variable bindings, similar clusters |
| Typography analysis | `analyze_typography` | Font families, sizes, weights, frequencies |
| Spacing analysis | `analyze_spacing` | Gaps, paddings, grid compliance |
| Pattern detection | `analyze_clusters` | Repeated structures → potential components |
| Structural diff | `diff_jsx`, `diff_create` | Unified diff between two nodes |
| XPath queries | `query_nodes` | `//FRAME[@width < 300]`, `//TEXT[contains(@text, 'Hello')]` |

### What does NOT exist

1. **System/instructions prompt for code generation** — no guidance for the AI on how to convert design → code
2. **Component decomposition** — `analyze_clusters` finds repeated patterns, but doesn't determine component boundaries, props, variants, slots
3. **Design token → CSS variable mapping** — `list_variables` returns raw Figma variables, but nothing maps them to `--color-primary`, `var(--spacing-4)`, etc.
4. **Target stack awareness** — no concept of "this project uses Vue 3 + Tailwind" vs "React + CSS Modules"
5. **Production JSX output** — `export-jsx.ts` tailwind format produces unstyled `<div>` soup without component structure, prop interfaces, or framework idioms
6. **Verification** — no way to compare generated code output against the design visually

---

## Architecture

```
.fig design file
      │
      ▼
┌──────────────────────────────────────────────────────────────┐
│  PHASE 1: EXTRACTION  (tools exist)                          │
│                                                              │
│  get_page_tree → full structure                              │
│  get_components → component inventory                        │
│  list_variables → design tokens                              │
│  analyze_colors/typography/spacing → design system snapshot   │
│  analyze_clusters → repeated patterns                        │
│  describe → semantic roles per node                          │
│  get_jsx → structural JSX                                    │
│  export_svg → vector assets                                  │
│  export_image → screenshots for verification                 │
└──────────────┬───────────────────────────────────────────────┘
               │
               ▼
┌──────────────────────────────────────────────────────────────┐
│  PHASE 2: DECOMPOSITION  (needs: prompt + possibly tools)    │
│                                                              │
│  Which nodes are screens vs components vs primitives?        │
│  What props does each component accept?                      │
│  Which components have variants (state, size, theme)?        │
│  Which design variables map to which CSS tokens?             │
│  What's the component hierarchy / dependency graph?          │
└──────────────┬───────────────────────────────────────────────┘
               │
               ▼
┌──────────────────────────────────────────────────────────────┐
│  PHASE 3: CODE GENERATION  (needs: prompt)                   │
│                                                              │
│  Generate component files on target stack                    │
│  Map design tokens → CSS/theme variables                     │
│  Extract SVG assets for icons/illustrations                  │
│  Wire up component hierarchy and props                       │
│  Match typography, spacing, colors exactly                   │
└──────────────┬───────────────────────────────────────────────┘
               │
               ▼
┌──────────────────────────────────────────────────────────────┐
│  PHASE 4: VERIFICATION  (needs: prompt guidance)             │
│                                                              │
│  Compare generated code visually against design              │
│  Check token coverage, missing styles                        │
│  Verify responsive behavior                                  │
└──────────────────────────────────────────────────────────────┘
```

---

## What to Build

### 1. MCP System Prompt for Code Generation

A system prompt served when AI is asked to generate code from a design. Not the same as the design-chat prompt in `use-chat.ts`. This one instructs the AI to use extraction tools, decompose the design, and output production code.

**Content outline:**

```
You are a frontend engineer generating production code from Figma designs.

# Workflow

1. UNDERSTAND the design
   - get_page_tree → scan structure
   - get_components → inventory reusable parts
   - list_variables + list_collections → design tokens
   - analyze_colors, analyze_typography, analyze_spacing → design system snapshot

2. PLAN the component tree
   - analyze_clusters → find repeated patterns
   - describe on key nodes → semantic roles
   - Determine: which frames are pages/screens, which are components, which are primitives
   - Map Figma components → code components
   - Identify props: text content, colors, sizes, visibility, children (slots)
   - Identify variants: if component has states (hover, active, disabled), map to props

3. EXTRACT design tokens
   - list_variables → get all variables with values per mode (light/dark)
   - Map to CSS custom properties or theme object
   - Color variables → --color-{name}
   - Number variables → --spacing-{name}, --radius-{name}, etc.
   - Fonts → font-family definitions

4. GENERATE code
   - One component per file
   - Use get_jsx on each component to read structure
   - Use export_svg for vector icons/illustrations
   - Apply design tokens as CSS variables / theme references
   - Match pixel values exactly: font sizes, spacing, radii, colors
   - Framework-specific:
     - React: functional components, TypeScript props interface, named exports
     - Vue: <script setup lang="ts">, defineProps, <template>
     - Svelte: $props, <script lang="ts">
   - Styling:
     - Tailwind: utility classes, arbitrary values for exact matches
     - CSS Modules: .module.css with variables
     - Styled-components: tagged templates with theme

5. VERIFY
   - Re-read the design with describe
   - Compare against generated code structure
   - Check: all text content matches, all colors use tokens, spacing is correct
   - List any deviations
```

### 2. Tool: `design_to_tokens`

Automates Phase 2 token mapping. Could be a tool or a prompt-guided workflow.

```typescript
defineTool({
  name: 'design_to_tokens',
  description: 'Extract design tokens as CSS custom properties from Figma variables.',
  params: {
    format: { type: 'string', enum: ['css', 'tailwind', 'json'], description: 'Output format' }
  },
  execute: (figma, args) => {
    const vars = figma.getLocalVariables()
    const collections = figma.getLocalVariableCollections()
    // Map variables to CSS custom properties
    // Group by collection → mode → variable
    // Output :root { --color-primary: #3b82f6; ... }
    // Or tailwind.config.ts theme extension
    // Or JSON token file
  }
})
```

### 3. Tool: `design_to_component_map`

Automates Phase 2 decomposition. Analyzes the document and returns a structured component map.

```typescript
defineTool({
  name: 'design_to_component_map',
  description: 'Analyze document structure and return a component decomposition map.',
  params: {
    page: { type: 'string', description: 'Page name to analyze' },
    depth: { type: 'number', description: 'Max nesting depth (default: 3)' }
  },
  execute: (figma, args) => {
    // 1. Get all COMPONENT/COMPONENT_SET nodes
    // 2. For each, analyze: name, variants, instance count, props (overridden fields)
    // 3. Get all top-level frames that aren't components → these are screens/pages
    // 4. For each screen, walk tree and record which components are used where
    // Return:
    // {
    //   components: [{ id, name, variants, props, instanceCount, usedIn }],
    //   screens: [{ id, name, components: [refs] }],
    //   tokens: { colors: [...], typography: [...], spacing: [...] }
    // }
  }
})
```

### 4. Enhanced `get_jsx` with Production Format

Add a third format to `export-jsx.ts` that outputs framework-aware code:

```typescript
// format: 'react' | 'vue' | 'svelte'
// Uses component names from Figma, maps design tokens, adds prop interfaces
```

Or this could be entirely prompt-driven, using existing `get_jsx` output as input and letting the AI transform it.

### 5. MCP Prompt File Serving

The MCP server needs a way to serve the code generation prompt. Options:

**Option A: Bake into system prompt** — The MCP server's `createServer()` sets instructions in server metadata. External AI clients (Claude Code, Cursor, etc.) receive it automatically.

**Option B: Dedicated tool** — `get_codegen_guidelines` tool that returns the prompt text. AI calls it when code generation is requested.

**Option C: MCP Resource** — Serve as an MCP resource (`prompts/codegen`) that clients can read.

Recommendation: **Option A** — system prompt in MCP server metadata + **Option B** as fallback for clients that don't read server instructions.

---

## What NOT to Build

1. **Framework-specific design-generation prompts** — those are for generating designs, not code. We already have the design-chat prompt.

2. **Batch operation DSL** — we have `render` with JSX + 88 atomic tools, no need for a custom batch language.

3. **Hardcoded framework templates** — Don't bake React/Vue/Svelte templates into tools. Let the AI generate idiomatic code guided by the prompt. The prompt tells it the target stack; the AI writes the code.

4. **Style guide / inspiration system** — That's for design generation, not code generation. Out of scope.

---

## Implementation Order

1. **Write the system prompt** — the code generation instruction document. Test with MCP + Claude Code on a real .fig file.
2. **Add `design_to_tokens` tool** — deterministic token extraction, CSS/Tailwind/JSON output.
3. **Add `design_to_component_map` tool** — structural component decomposition.
4. **Integrate prompt into MCP server** — serve via server instructions + tool fallback.
5. **Test & iterate** — run on real designs, evaluate output quality.

Step 1 is the highest leverage: a good prompt with existing tools will already produce usable code. Steps 2-3 improve quality by reducing AI guesswork.
