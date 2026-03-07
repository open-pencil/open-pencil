# figma-comparison-docs Specification

## Purpose
VitePress documentation page with feature-by-feature comparison tables mapping Figma Design features to Open Pencil's implementation status. Sourced from Figma help center articles (~90) and cross-referenced against Open Pencil's specs and features.
## Requirements
### Requirement: Feature comparison page exists
The documentation site SHALL include a page at `packages/docs/guide/figma-comparison.md` that provides feature-by-feature comparison tables mapping Figma Design features to Open Pencil status.

#### Scenario: Page is accessible
- **WHEN** user navigates to `/guide/figma-comparison` on the docs site
- **THEN** the page renders with title "Figma Feature Matrix" and contains comparison tables

### Requirement: Tables organized by Figma categories
The comparison page SHALL group features into tables by Figma's documentation categories: Interface & Navigation, Layers & Shapes, Vector Tools, Text & Typography, Color Gradients & Images, Effects & Properties, Auto Layout, Components & Design Systems, Prototyping, Import & Export, Collaboration, Dev Mode.

#### Scenario: All categories present
- **WHEN** user views the comparison page
- **THEN** each Figma documentation category has its own section heading and table

### Requirement: Three-tier status system
Each feature row SHALL use one of three status indicators: ✅ (supported — feature works), 🟡 (partial — core behavior exists but advanced options missing), 🔲 (not yet — feature not implemented).

#### Scenario: Status indicators are consistent
- **WHEN** a feature is listed in the comparison table
- **THEN** its status column contains exactly one of ✅, 🟡, or 🔲

### Requirement: Feature rows include notes
Each table row SHALL contain columns: Feature, Status, Notes. The Notes column provides brief context such as what works, what's missing, or relevant Open Pencil implementation details. Statuses SHALL be updated when features are implemented.

#### Scenario: Notes explain partial status
- **WHEN** a feature has 🟡 partial status
- **THEN** the Notes column explains what is supported and what is missing

#### Scenario: Component status updated
- **WHEN** user views the Components & Design Systems table
- **THEN** component creation, instances, and detach show current implementation status

### Requirement: Last-updated timestamp
The page SHALL display a last-updated date at the top so readers know the freshness of the comparison data.

#### Scenario: Date is visible
- **WHEN** user views the page
- **THEN** a "Last updated" line is visible near the top of the page

### Requirement: Sidebar integration
The VitePress config SHALL include the new page in the Guide sidebar section.

#### Scenario: Sidebar shows link
- **WHEN** user views any docs page
- **THEN** the sidebar Guide section includes a "Figma Feature Matrix" link pointing to `/guide/figma-comparison`
