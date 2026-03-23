## MODIFIED Requirements

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
