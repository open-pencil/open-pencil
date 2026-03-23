## MODIFIED Requirements

### Requirement: Assets panel displays all components grouped by page
The Assets panel SHALL list all COMPONENT and COMPONENT_SET nodes in the document, grouped under collapsible page sections (expanded by default). These component groups SHALL be wrapped in a top-level collapsible "Components (N)" section where N is the total component count. Below the components section, an "Images (N)" section lists embedded images. Both sections are independently collapsible. When the document has neither components nor images, a combined empty state is shown. The search input filters both sections independently. When inserting assets at viewport center (via double-click or context menu), the center SHALL be calculated from the actual canvas element bounds, accounting for left and right sidebars.

#### Scenario: Insert at correct viewport center
- **WHEN** user double-clicks a component in the Assets panel with left sidebar at 300px and right sidebar at 300px
- **THEN** the instance appears at the center of the visible canvas area between the sidebars, not at window center

#### Scenario: Document with components and images
- **WHEN** the document has 5 components and 3 images
- **THEN** the Assets panel shows "Components (5)" section with page groups and "Images (3)" section with image entries

#### Scenario: Search filters both sections
- **WHEN** user types "btn" in search
- **THEN** components matching "btn" appear under Components, images whose referencing nodes match "btn" appear under Images, empty sections are hidden
