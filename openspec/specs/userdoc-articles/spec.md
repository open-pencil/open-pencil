# userdoc-articles Specification

## Purpose
TBD - created by archiving change vitepress-userdoc. Update Purpose after archive.
## Requirements
### Requirement: User guide landing page
The docs site SHALL have an `index.md` at `packages/docs/user-guide/` with the title "User Guide", a brief description positioning OpenPencil as an open-source, Figma-compatible design editor, and links to all user guide articles organized by category.

#### Scenario: Landing page renders
- **WHEN** user navigates to /user-guide/
- **THEN** a page with "User Guide" title, open-source/Figma-compatible positioning, and categorized links to all articles is displayed

### Requirement: Canvas navigation article
The docs site SHALL have a `canvas-navigation.md` article in `packages/docs/user-guide/` documenting panning (space+drag, middle mouse, trackpad, hand tool), zooming (ctrl+scroll, pinch, keyboard shortcuts), and zoom reset.

#### Scenario: Canvas navigation article renders
- **WHEN** user navigates to /user-guide/canvas-navigation
- **THEN** an article explaining panning, zooming, and hand tool usage is displayed with a shortcuts table

### Requirement: Selection and manipulation article
The docs site SHALL have a `selection-and-manipulation.md` article documenting click select, shift multi-select, marquee selection, move by drag, resize handles, rotation with shift snapping, alt+drag duplicate, ⌘D duplicate, nudge with arrows, delete, select all, z-order (]/[), visibility toggle (⇧⌘H), lock toggle (⇧⌘L), and move-to-page.

#### Scenario: Selection article renders
- **WHEN** user navigates to /user-guide/selection-and-manipulation
- **THEN** an article explaining all selection and manipulation operations is displayed

### Requirement: Drawing shapes article
The docs site SHALL have a `drawing-shapes.md` article documenting the bottom toolbar shape tools: Rectangle (R), Ellipse (O), Line (L), Polygon, Star, Frame (F), Section (S). It SHALL cover constrained drawing with Shift, shape properties (fill, stroke, corner radius, effects), and the shapes flyout.

#### Scenario: Drawing shapes article renders
- **WHEN** user navigates to /user-guide/drawing-shapes
- **THEN** an article explaining shape creation with tool shortcuts and property editing is displayed

### Requirement: Auto-layout article
The docs site SHALL have an `auto-layout.md` article documenting Shift+A toggle, layout direction, gap, padding, justify, align, child sizing (fixed/fill/hug), drag reordering, and wrapping selection in auto-layout.

#### Scenario: Auto-layout article renders
- **WHEN** user navigates to /user-guide/auto-layout
- **THEN** an article explaining auto-layout creation and configuration is displayed

### Requirement: Components article
The docs site SHALL have a `components.md` article documenting component creation (⌥⌘K), component sets (⇧⌘K), instance creation (context menu), detach instance (⌥⌘B), go-to-main-component, live sync, overrides, and visual treatment (purple labels, dashed borders).

#### Scenario: Components article renders
- **WHEN** user navigates to /user-guide/components
- **THEN** an article explaining the full component workflow is displayed

### Requirement: Text editing article
The docs site SHALL have a `text-editing.md` article documenting the Text tool (T), inline editing (double-click), cursor navigation (arrow keys, ⌘←/→, ⌥←/→), text selection (click, drag, double-click word, triple-click all), rich text formatting (⌘B/I/U), font picker, and font weight.

#### Scenario: Text editing article renders
- **WHEN** user navigates to /user-guide/text-editing
- **THEN** an article explaining text creation and editing is displayed

### Requirement: Pen tool article
The docs site SHALL have a `pen-tool.md` article documenting the Pen tool (P), placing corner points (click), curve points (click+drag with bezier handles), closing paths (click first point), committing open paths (Escape), and the preview line.

#### Scenario: Pen tool article renders
- **WHEN** user navigates to /user-guide/pen-tool
- **THEN** an article explaining vector path creation is displayed

### Requirement: Layers and pages article
The docs site SHALL have a `layers-and-pages.md` article documenting the layers panel (tree view, expand/collapse, drag reorder, visibility toggle, rename), pages panel (switch, add, delete, rename), and the properties panel tabs (Design, Code, AI).

#### Scenario: Layers and pages article renders
- **WHEN** user navigates to /user-guide/layers-and-pages
- **THEN** an article explaining layer management and page operations is displayed

### Requirement: Context menu article
The docs site SHALL have a `context-menu.md` article documenting right-click actions: clipboard (copy, cut, paste, duplicate, delete), z-order (bring to front, send to back), grouping (group, ungroup, add auto-layout), component actions, visibility/lock, and move-to-page submenu.

#### Scenario: Context menu article renders
- **WHEN** user navigates to /user-guide/context-menu
- **THEN** an article listing all context menu actions with their shortcuts is displayed

### Requirement: Exporting article
The docs site SHALL have an `exporting.md` article documenting the export section in properties panel (scale, format, multi-export), export via context menu, ⇧⌘E shortcut, supported formats (PNG, JPG, WEBP), .fig file save (⌘S, ⇧⌘S), and .fig file import.

#### Scenario: Exporting article renders
- **WHEN** user navigates to /user-guide/exporting
- **THEN** an article explaining image export and file operations is displayed

### Requirement: Variables article
The docs site SHALL have a `variables.md` article documenting the variables dialog (collections, modes, table), creating variables, editing values, color variables, binding variables to fills, and detaching variable bindings.

#### Scenario: Variables article renders
- **WHEN** user navigates to /user-guide/variables
- **THEN** an article explaining design variables and their usage is displayed

### Requirement: Cross-platform shortcut note
Each article that includes keyboard shortcuts SHALL include a note that ⌘ corresponds to Ctrl on Windows/Linux, and ⌥ corresponds to Alt.

#### Scenario: Shortcut platform note present
- **WHEN** user reads any user guide article with a shortcuts table
- **THEN** a note about cross-platform key equivalents is visible

### Requirement: Consistent article structure
Each user guide article SHALL follow a consistent structure: title, brief introduction, feature walkthrough with subsections, keyboard shortcuts table (where applicable), and tips section.

#### Scenario: Article structure consistency
- **WHEN** user reads any user guide article
- **THEN** the article has an intro paragraph, subsections explaining features, and a shortcuts table


### Requirement: Stroke align and per-side weights (sync-docs-v07-v08)

The drawing-shapes article SHALL document stroke alignment (Inside/Center/Outside) and per-side weights (Top/Right/Bottom/Left).

#### Scenario: Stroke align documented
- **WHEN** user reads Drawing Shapes
- **THEN** Inside/Center/Outside alignment is described

### Requirement: Layer inline rename (sync-docs-v07-v08)

The layers-and-pages article SHALL document double-click to rename inline with Enter/Escape/blur to commit.

### Requirement: Copy/Paste as in context-menu (sync-docs-v07-v08)

A Copy/Paste as section SHALL be present in context-menu article for all locales.

### Requirement: Mobile drawer note (sync-docs-v07-v08)

The layers-and-pages article SHALL mention the mobile bottom drawer layout.

### Requirement: Code panel format toggle (sync-docs-v07-v08)

The Code Tab description SHALL mention OpenPencil JSX and Tailwind CSS v4 format toggle.

### Requirement: Locale parity (sync-docs-v07-v08)

DE, ES, FR, IT, PL translations SHALL include all sections present in EN for features.md, comparison.md, figma-comparison.md, exporting.md, drawing-shapes.md, layers-and-pages.md, and context-menu.md.
