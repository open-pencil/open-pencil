# editor-ui Specification

## Purpose
Vue 3 + Reka UI editor interface. Bottom toolbar, layers panel with tree view and drag reorder, properties panel with sectioned layout (appearance, fill, stroke, typography, layout, position), color picker, and Lucide icons.
## Requirements
### Requirement: Vue 3 + Reka UI component architecture
The editor UI SHALL be built with Vue 3, VueUse composables, and Reka UI headless components. The UI framework was migrated from React to Vue 3.

#### Scenario: Editor loads
- **WHEN** user opens the editor at localhost:1420
- **THEN** the Vue 3 application renders with canvas, toolbar, layers panel, and properties panel

### Requirement: Bottom toolbar
The toolbar SHALL be positioned at the bottom of the screen (Figma UI3 style) with tool selection: Select (V), Frame (F), Section (S, in Frame flyout), Rectangle (R), Ellipse (O), Line (L), Polygon (flyout), Star (flyout), Text (T), Hand (H), Pen (P). The shapes flyout (Rectangle, Line, Ellipse, Polygon, Star) SHALL display keyboard shortcuts right-aligned for tools that have them.

#### Scenario: Tool selection via keyboard
- **WHEN** user presses R
- **THEN** the rectangle tool is activated and the toolbar shows R as selected

#### Scenario: Frame flyout includes Section
- **WHEN** user opens the Frame tool flyout
- **THEN** both Frame and Section tools are available

#### Scenario: Shapes flyout includes Polygon and Star
- **WHEN** user opens the shapes flyout
- **THEN** Polygon (triangle icon) and Star (star icon) are listed alongside Rectangle, Line, and Ellipse

#### Scenario: Draw polygon on canvas
- **WHEN** user selects Polygon tool and drags on canvas
- **THEN** a POLYGON node is created with default 3 sides

#### Scenario: Draw star on canvas
- **WHEN** user selects Star tool and drags on canvas
- **THEN** a STAR node is created with 5 points and 0.38 inner radius

### Requirement: Layers panel with tree view
The layers panel SHALL display a tree view of the document hierarchy using Reka UI Tree with expand/collapse and drag reordering. The bottom section of the left panel SHALL have a reka-ui TabsRoot with two TabsTrigger buttons: "Layers" and "Assets". The "Layers" tab shows the LayerTree component (default). The "Assets" tab shows the AssetsPanel component. The PagesPanel remains in the top SplitterPanel, always visible above both tabs. The active tab is stored as `leftPanelTab: 'layers' | 'assets'` in the editor state (default: `'layers'`). Tab triggers use `text-[11px] tracking-wider uppercase text-muted` styling, matching the current header, with `data-[state=active]:font-semibold data-[state=active]:text-surface` for active state.

#### Scenario: Expand/collapse frame children
- **WHEN** user clicks the chevron next to a frame in the layers panel
- **THEN** the frame's children are shown or hidden

#### Scenario: Drag reorder layers
- **WHEN** user drags a layer to a new position in the layers panel
- **THEN** the node's z-order in the scene graph changes accordingly

#### Scenario: Visibility toggle
- **WHEN** user clicks the visibility icon next to a layer
- **THEN** the node is hidden/shown on canvas

#### Scenario: Switch to Assets tab
- **WHEN** user clicks "Assets" tab in the left panel
- **THEN** the layer tree is hidden and the Assets panel is shown with components grouped by page

#### Scenario: Switch back to Layers tab
- **WHEN** user clicks "Layers" tab while viewing Assets
- **THEN** the Assets panel is hidden and the layer tree is shown

#### Scenario: PagesPanel always visible
- **WHEN** user switches between Layers and Assets tabs
- **THEN** the PagesPanel above the splitter handle remains visible and functional

### Requirement: Properties panel with tabs
The properties panel SHALL be organized as a tabbed interface with Design | Code | AI tabs (reka-ui Tabs). The Design tab (DesignPanel) contains sections: Appearance (opacity, corner radius with independent mode, visibility toggle), Fill, Stroke, Effects, Typography, Layout, Position. The Code tab shows JSX export. The AI tab shows the chat interface.

#### Scenario: Properties panel shows fill section
- **WHEN** user selects a rectangle with a blue fill
- **THEN** the Fill section shows the hex color #3B82F6 with opacity and visibility controls

#### Scenario: Editable hex input
- **WHEN** user types a new hex value in the fill section
- **THEN** the node's fill updates to the entered color

### Requirement: Color picker
The color picker SHALL provide HSV color selection, hue slider, alpha slider, hex input, and opacity control.

#### Scenario: Change color via HSV
- **WHEN** user moves the color picker cursor in the HSV square
- **THEN** the selected node's fill updates in real time

### Requirement: Lucide icons via Iconify
UI icons SHALL use Lucide icons loaded via unplugin-icons with Iconify, replacing inline emoji/SVG.

#### Scenario: Icon rendering
- **WHEN** the toolbar renders tool icons
- **THEN** Lucide icons are displayed via the icon auto-import resolver

### Requirement: Tailwind CSS 4 styling
The editor SHALL use Tailwind CSS 4 for all styling.

#### Scenario: Dark theme
- **WHEN** the editor renders
- **THEN** the UI uses a dark theme styled with Tailwind CSS 4 utility classes

### Requirement: Pages panel
The editor SHALL display a PagesPanel component showing all pages in the document. Users can switch pages, add pages, delete pages, and rename pages inline (blur commits, Enter/Escape just blur).

#### Scenario: Switch page
- **WHEN** user clicks a page tab in the pages panel
- **THEN** the canvas switches to that page and viewport state is restored

#### Scenario: Add page
- **WHEN** user clicks the add page button
- **THEN** a new page is created and becomes active

#### Scenario: Inline page rename
- **WHEN** user double-clicks a page name
- **THEN** an inline text input appears, blur commits the rename

### Requirement: Section tool
The toolbar SHALL include a Section tool (shortcut <kbd>S</kbd>) in the Frame flyout. Drawing on canvas creates a SECTION node.

#### Scenario: Section tool activation
- **WHEN** user presses S
- **THEN** the section tool activates and the toolbar shows Section as selected

### Requirement: Fill type picker with gradient and image support
The fill section in the properties panel SHALL provide a type picker with tabs: Solid, Gradient (Linear, Radial, Angular, Diamond), and Image. Gradient fills show editable gradient stops. Image fills show image selection.

#### Scenario: Switch fill to linear gradient
- **WHEN** user selects "Linear Gradient" from the fill type picker
- **THEN** the selected node's fill changes to GRADIENT_LINEAR with default stops and the gradient stop editor appears

#### Scenario: Edit gradient stop
- **WHEN** user drags a gradient stop to position 50%
- **THEN** the stop position updates and the node re-renders with the adjusted gradient

### Requirement: Page background color
The properties panel SHALL show a page section with canvas background color picker when no nodes are selected.

#### Scenario: Change canvas background
- **WHEN** user selects no nodes and changes the page color
- **THEN** the canvas background updates to the chosen color

### Requirement: Hover highlight in canvas
The editor SHALL highlight nodes on hover with a shape-aware outline (follows actual geometry, not just bounding box).

#### Scenario: Hover feedback
- **WHEN** user moves cursor over a node without clicking
- **THEN** a highlight outline appears around the node shape


### Requirement: Component keyboard shortcuts
The editor SHALL support keyboard shortcuts for component operations: ⌥⌘K (create component), ⌥⌘B (detach instance), ⇧⌘K (create component set).

#### Scenario: Create component shortcut
- **WHEN** user selects a frame and presses ⌥⌘K
- **THEN** the frame becomes a component

### Requirement: Z-order keyboard shortcuts
The editor SHALL support ] (bring to front) and [ (send to back) keyboard shortcuts.

#### Scenario: Bring to front shortcut
- **WHEN** user selects a node and presses ]
- **THEN** the node moves to the top of its z-order

### Requirement: Visibility and lock keyboard shortcuts
The editor SHALL support ⇧⌘H (toggle visibility) and ⇧⌘L (toggle lock) keyboard shortcuts.

#### Scenario: Toggle visibility shortcut
- **WHEN** user selects a node and presses ⇧⌘H
- **THEN** the node's visibility toggles

### Requirement: Effects section in properties panel
The properties panel SHALL include an Effects section showing all effects on the selected node. Each effect displays as a collapsible row with: color swatch (shadows) or blur icon (blurs), type dropdown (DROP_SHADOW, INNER_SHADOW, LAYER_BLUR, BACKGROUND_BLUR, FOREGROUND_BLUR), visibility toggle, and remove button. Clicking a row expands inline controls.

#### Scenario: Add drop shadow effect
- **WHEN** user clicks the + button in the Effects section
- **THEN** a DROP_SHADOW effect is added with default values (offset 0,4; radius 4; spread 0; color rgba(0,0,0,0.25))

#### Scenario: Switch effect type
- **WHEN** user changes the type dropdown from DROP_SHADOW to LAYER_BLUR
- **THEN** the effect type updates and offset/spread fields are hidden (only blur radius shown)

#### Scenario: Inline shadow controls
- **WHEN** user expands a shadow effect row
- **THEN** X/Y offset, blur radius, spread, color picker, hex input, and opacity controls appear inline

#### Scenario: Toggle effect visibility
- **WHEN** user clicks the eye icon on an effect row
- **THEN** the effect's `visible` property toggles and the canvas re-renders

#### Scenario: Remove effect
- **WHEN** user clicks the − button on an effect row
- **THEN** the effect is removed from the node

### Requirement: Independent corner radius toggle in Appearance section
The Appearance section SHALL show a corner radius toggle button for RECTANGLE, ROUNDED_RECTANGLE, FRAME, COMPONENT, and INSTANCE nodes. When toggled to independent mode, a 2×2 grid of per-corner radius inputs (top-left, top-right, bottom-left, bottom-right) replaces the single radius input. Each corner has a distinct icon. Toggling back to uniform sets all corners to the top-left value.

#### Scenario: Toggle to independent corners
- **WHEN** user clicks the independent corners button
- **THEN** four separate corner radius inputs appear in a grid layout

#### Scenario: Toggle back to uniform
- **WHEN** user clicks the independent corners button while in independent mode
- **THEN** a single corner radius input appears, set to the top-left value

### Requirement: Resizable panels
The left (layers) and right (properties) panels SHALL be resizable via reka-ui Splitter components (SplitterGroup, SplitterPanel, SplitterResizeHandle). Default width SHALL be 15%, minimum 10%, maximum 30%. Panel layout SHALL persist across reloads via auto-save-id. The resize handle SHALL be 8px wide with negative margins and a centered 1px visible line that highlights blue on hover/drag.

#### Scenario: Resize layers panel
- **WHEN** user drags the resize handle between layers panel and canvas
- **THEN** the layers panel width changes and the canvas resizes accordingly

#### Scenario: Panel size persists
- **WHEN** user resizes panels and reloads the page
- **THEN** panel widths are restored to the previous sizes

### Requirement: Throttled WebGL surface recreation during resize
The CanvasKit surface SHALL be recreated at most once per animation frame during panel resize, coalesced via requestAnimationFrame in the ResizeObserver callback.

#### Scenario: Panel resize performance
- **WHEN** user drags a panel resize handle continuously
- **THEN** the WebGL surface is recreated at most once per frame

### Requirement: Variables dialog
The editor SHALL display a VariablesSection in the page-level properties panel showing variable/collection counts and a settings icon. Clicking the icon opens a VariablesDialog (reka-ui Dialog) with: collection tabs (reka-ui Tabs, double-click to rename), a TanStack Table (@tanstack/vue-table) with resizable columns (Name | Mode 1 | Mode 2 | ...), search bar, and a "+ Create variable" button. Color variables display inline ColorInput with picker. Variable names and values are editable inline (reka-ui Editable).

#### Scenario: Open variables dialog
- **WHEN** user clicks the settings icon in the Variables section of page properties
- **THEN** a dialog opens showing collection tabs and a variables table

#### Scenario: Rename collection
- **WHEN** user double-clicks a collection tab name
- **THEN** the tab becomes editable for renaming

#### Scenario: Resize table columns
- **WHEN** user drags a column border in the variables table header
- **THEN** the column width adjusts

#### Scenario: Search variables
- **WHEN** user types in the search bar in the variables dialog
- **THEN** only variables matching the search term are shown

#### Scenario: Edit variable value
- **WHEN** user clicks a variable value cell in the table
- **THEN** an editable input allows changing the value for that mode

### Requirement: Fill section variable picker
The fill section SHALL include a variable picker (reka-ui Popover + Combobox) to bind a color variable to a fill. Bound fills display a purple variable name badge with a detach button.

#### Scenario: Bind variable to fill
- **WHEN** user selects a color variable from the fill variable picker
- **THEN** the fill shows a purple badge with the variable name

#### Scenario: Detach variable from fill
- **WHEN** user clicks the detach button on a bound fill
- **THEN** the variable binding is removed and the fill shows the resolved color

### Requirement: Export section in properties panel
The properties panel SHALL include an ExportSection when nodes are selected. The section provides: scale selector (0.5×, 0.75×, 1×, 1.5×, 2×, 3×, 4×), format picker (PNG, JPG, WEBP), multi-export support (add/remove export settings), live preview with checkerboard background, and an Export button. JPG uses white background, PNG/WEBP use transparency.

#### Scenario: Export as PNG
- **WHEN** user sets format to PNG, scale to 2×, and clicks Export
- **THEN** a 2× resolution PNG is saved via native dialog / FSAPI / download

#### Scenario: Export via context menu
- **WHEN** user right-clicks a node and selects "Export…"
- **THEN** the export flow starts for the selected node

#### Scenario: Export via keyboard shortcut
- **WHEN** user presses ⇧⌘E with a node selected
- **THEN** the export flow starts

### Requirement: Splash loader
The editor SHALL display a minimalist loading animation (centered logo + progress bar) during WASM (CanvasKit) initialization. The loader fades out when the canvas is ready.

#### Scenario: Initial load
- **WHEN** user opens the editor
- **THEN** a splash loader is shown until CanvasKit WASM is loaded, then fades out

### Requirement: ColorInput component
A reusable ColorInput component SHALL display a color swatch with ColorPicker and an optional hex input. It SHALL replace duplicated color picker + hex input patterns in PageSection, StrokeSection, EffectsSection, and VariablesDialog.

#### Scenario: Color input with editing
- **WHEN** ColorInput is rendered with editable=true
- **THEN** a swatch with picker and an editable hex input are shown

#### Scenario: Color input read-only
- **WHEN** ColorInput is rendered with editable=false (default)
- **THEN** a swatch with picker and a read-only hex label are shown

### Requirement: ColorPicker alpha slider checkerboard
The ColorPicker alpha slider SHALL display a checkerboard background behind the transparent-to-color gradient, matching FillPicker's implementation.

#### Scenario: Alpha slider visual
- **WHEN** user opens a ColorPicker
- **THEN** the alpha slider shows a checkerboard pattern indicating transparency

### Requirement: Demo variable collections
The demo document SHALL include three variable collections demonstrating multi-mode and alias features: Primitives (Light/Dark modes, 9 color variables), Semantic (aliases to Primitives), and Spacing (Default/Compact modes, 8 number variables). Variables SHALL be bound to demo nodes.

#### Scenario: Demo loads with variables
- **WHEN** the demo document is created
- **THEN** three collections with variables and bindings are present in the scene graph

### Requirement: Rich text formatting buttons
The TypographySection SHALL include B/I/U/S toggle buttons for Bold, Italic, Underline, and Strikethrough. When text is selected during editing, the buttons apply formatting to the selection. When editing with no selection, they toggle the whole-node style. The active state reflects current selection formatting.

#### Scenario: Bold button with selection
- **WHEN** user selects text and clicks the Bold button (or presses ⌘B)
- **THEN** the selection becomes bold and the B button shows active state

#### Scenario: Underline button with no selection
- **WHEN** user clicks the Underline button during editing with no selection
- **THEN** the entire text node's underline style toggles

### Requirement: AI chat panel
The editor SHALL include an AI chat panel accessible via the AI tab in properties panel or ⌘J shortcut. The panel provides: message list with streaming markdown (vue-stream-markdown), tool call timeline with collapsible details (reka-ui Collapsible), typing indicator, API key setup for OpenRouter (stored in Tauri Stronghold). Messages scroll automatically (reka-ui ScrollArea).

#### Scenario: Send message
- **WHEN** user types a message and presses Enter in the chat input
- **THEN** the message is sent to OpenRouter and a streaming response appears

#### Scenario: Toggle chat
- **WHEN** user presses ⌘J
- **THEN** the properties panel switches to the AI tab (or back to Design)

### Requirement: AI model selector
The chat input SHALL include a model selector with curated models: Claude, Gemini, GPT, DeepSeek, Qwen, Kimi, Llama. Models are stored in @open-pencil/core constants with benchmark-ranked tags.

#### Scenario: Change model
- **WHEN** user selects a different model from the selector
- **THEN** subsequent messages use the selected model

### Requirement: AI tools
The chat SHALL support 10 design tools with valibot schemas: create_shape, set_fill, set_stroke, update_node, set_layout, delete_node, select_nodes, get_page_tree, get_selection, rename_node. Tools execute against the editor store. The ToolLoopAgent calls tools automatically in a loop.

#### Scenario: AI creates a shape
- **WHEN** user asks "Create a blue rectangle 200×100"
- **THEN** the AI calls create_shape with type RECTANGLE, width 200, height 100, and set_fill with blue color

#### Scenario: Tool call visible in chat
- **WHEN** the AI executes a tool
- **THEN** a collapsible tool call section shows the tool name, input, and output

### Requirement: DirectChatTransport
The chat SHALL communicate directly with OpenRouter from the browser — no backend server required. The API key is stored securely in Tauri Stronghold (or localStorage fallback in browser). X-OpenRouter-Title header identifies the app.

#### Scenario: No backend required
- **WHEN** user configures an OpenRouter API key and sends a message
- **THEN** the request goes directly to OpenRouter without a proxy server

### Requirement: Code panel with JSX export
The properties panel Code tab SHALL display the selected node(s) as JSX code using sceneNodeToJsx(). The panel provides Prism.js syntax highlighting, line numbers, and a copy-to-clipboard button. Multi-selection shows each node's JSX.

#### Scenario: View JSX for selection
- **WHEN** user selects a frame and clicks the Code tab
- **THEN** the JSX representation of the frame and its children is displayed with syntax highlighting

#### Scenario: Copy JSX
- **WHEN** user clicks the copy button in the Code panel
- **THEN** the JSX code is copied to the clipboard
