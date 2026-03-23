## MODIFIED Requirements

### Requirement: Assets panel displays all components grouped by page
The Assets panel SHALL list all COMPONENT and COMPONENT_SET nodes in the document, grouped under collapsible page sections (expanded by default). These component groups SHALL be wrapped in a top-level collapsible "Components (N)" section where N is the total component count. Below the components section, an "Images (N)" section lists embedded images. Both sections are independently collapsible. When the document has neither components nor images, a combined empty state is shown. The search input filters both sections independently.

#### Scenario: Document with components and images
- **WHEN** the document has 5 components and 3 images
- **THEN** the Assets panel shows "Components (5)" section with page groups and "Images (3)" section with image entries

#### Scenario: Search filters both sections
- **WHEN** user types "btn" in search
- **THEN** components matching "btn" appear under Components, images whose referencing nodes match "btn" appear under Images, empty sections are hidden

#### Scenario: Document with only images
- **WHEN** the document has no components but 2 images
- **THEN** only the "Images (2)" section is shown, no Components section

#### Scenario: Empty document
- **WHEN** the document has no components and no images
- **THEN** a combined empty state is shown: "No assets"
