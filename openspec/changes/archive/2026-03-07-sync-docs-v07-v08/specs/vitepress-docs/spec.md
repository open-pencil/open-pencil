# vitepress-docs — delta spec (sync-docs-v07-v08)

## Requirement: SVG export documentation

The features page and exporting article SHALL document SVG as an export format alongside PNG/JPG/WEBP. The Export section in the properties panel, context menu, CLI, and MCP/AI tool SHALL all be mentioned.

### Scenario: SVG export documented in features
- **WHEN** user reads the Features page
- **THEN** SVG export is listed as an export format with mention of CLI and MCP tool support

### Scenario: SVG in exporting article format table
- **WHEN** user reads the Exporting user guide article
- **THEN** SVG appears in the format table with a note that scale selector is hidden for SVG

## Requirement: Copy/Paste as submenu documentation

The context menu article and features page SHALL document the Copy/Paste as submenu with four options: Copy as text, Copy as SVG, Copy as PNG (⇧⌘C), Copy as JSX.

### Scenario: Copy/Paste as documented in context menu article
- **WHEN** user reads the Context Menu article
- **THEN** a "Copy/Paste as" section lists all four copy formats with shortcuts

## Requirement: Homebrew install in Getting Started

The Getting Started guide SHALL include a Homebrew installation section for macOS before "Building from Source".

### Scenario: Homebrew section present
- **WHEN** user reads the Getting Started page
- **THEN** `brew install open-pencil/tap/open-pencil` is shown as a macOS install option

## Requirement: Keyboard shortcuts accuracy

The keyboard shortcuts reference SHALL mark ⌘N/⌘T (new tab), ⌘W (close tab), and ⌘\\ (toggle UI) as ✅. ⇧⌘C (Copy as PNG) SHALL be added with ✅ status.

### Scenario: New tab shortcuts marked implemented
- **WHEN** user reads the Keyboard Shortcuts reference
- **THEN** ⌘N, ⌘T, ⌘W appear as ✅ in the File section

### Scenario: Toggle UI marked implemented
- **WHEN** user reads the Keyboard Shortcuts reference
- **THEN** ⌘\\ Show/Hide UI appears as ✅ in the View section

## Requirement: MCP tools table completeness

The MCP tools reference SHALL list all 78 tools (75 core + 3 file ops) in their respective category tables. All tool groups from v0.5.0 and later SHALL be documented.

### Scenario: All 78 tools listed
- **WHEN** user reads the MCP Tools reference
- **THEN** all tool groups are documented with tool name and description for each of the 78 tools

## Requirement: Comparison tables accuracy

The `guide/comparison.md` (vs Penpot) SHALL reflect the current tool count (78), correct renderer LOC after the renderer split (~3,200 LOC across 10 files), and accurate scripting section. The "What Penpot Does Better" section SHALL NOT list server-side SVG export as a Penpot advantage since OpenPencil now exports SVG.

### Scenario: comparison.md tool counts current
- **WHEN** user reads the comparison with Penpot
- **THEN** OpenPencil tool count is stated as 78 (not 75)

### Scenario: SVG export not listed as Penpot advantage
- **WHEN** user reads the "What Penpot Does Better" section
- **THEN** SVG export is NOT listed as a Penpot-only feature

## Requirement: Figma feature matrix accuracy

The `guide/figma-comparison.md` SHALL have accurate status flags reflecting the current implementation:
- Rename layers: ✅ (double-click inline rename)
- Image/SVG export: ✅ (SVG added in v0.7.0)
- Copy/Paste as: ✅ (new row)
- Tailwind CSS v4 export: ✅ (new row in Code Panel section)
- Stroke align: ✅ (new row in Effects & Properties)
- Individual stroke weights per side: ✅ (new row)
- AI/MCP tool counts: 78

### Scenario: Rename layers shows ✅
- **WHEN** user reads the figma-comparison Layers & Shapes table
- **THEN** Rename layers row shows ✅ with inline rename note

### Scenario: SVG export shows ✅
- **WHEN** user reads the Import & Export table
- **THEN** Image/SVG export row shows ✅

## Requirement: Architecture roadmap section

The `guide/architecture.md` SHALL include a "What's Next" section documenting planned and in-progress work: additional AI providers, full figma-use tool set completion, CI design tooling, prototyping, CSS Grid (Yoga upstream blocker), PDF export, .fig fidelity improvements.

### Scenario: What's Next section present
- **WHEN** user reads the Architecture guide
- **THEN** a "What's Next" section lists upcoming features with context on blockers and status
