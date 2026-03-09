# fig-import Specification

## Purpose
.fig file import pipeline. Parses Figma file header, decompresses Zstd payload, decodes Kiwi schema, extracts NodeChange[], resolves blob references, and populates the scene graph.
## Requirements
### Requirement: .fig file import
The editor SHALL import .fig files via the Kiwi codec pipeline: parse header (magic "fig-kiwi" + version), decompress Zstd, decode Kiwi schema, extract NodeChange[], and build the scene graph.

#### Scenario: Import a .fig file
- **WHEN** user opens a .fig file
- **THEN** all nodes from the file appear on the canvas with correct types, positions, sizes, and visual properties

### Requirement: File open via keyboard
⌘O SHALL open a file dialog for .fig import.

#### Scenario: Open file dialog
- **WHEN** user presses ⌘O
- **THEN** a file picker dialog appears filtered for .fig files

### Requirement: Blob reference resolution
The import pipeline SHALL resolve blob references (images, vector networks, font data) from the .fig file's blob section.

#### Scenario: Import with vector blobs
- **WHEN** a .fig file containing vector nodes with vectorNetworkBlob data is imported
- **THEN** the vector paths are correctly decoded and renderable

### Requirement: .fig file export
The editor SHALL export documents as .fig files. The pipeline: scene graph → Kiwi encode NodeChange[] → compress → write ZIP with Kiwi header, schema, message, and thumbnail.

#### Scenario: Save As .fig
- **WHEN** user selects File → Save As
- **THEN** a save dialog appears and the document is written as a valid .fig file

#### Scenario: Save existing file
- **WHEN** user selects File → Save (⌘S) with a previously opened file
- **THEN** the file is overwritten in place without a dialog

### Requirement: Thumbnail generation for .fig export
Exported .fig files SHALL include a thumbnail.png in the ZIP archive, as required by Figma for file preview.

#### Scenario: Thumbnail in exported file
- **WHEN** a .fig file is exported
- **THEN** the ZIP archive contains a thumbnail.png

### Requirement: Zstd compression via Tauri Rust
On the desktop app, .fig export SHALL use Zstd compression via a Tauri Rust command for performance. In the browser, deflate fallback via fflate SHALL be used.

#### Scenario: Desktop export uses Zstd
- **WHEN** a .fig file is exported in the Tauri desktop app
- **THEN** the payload is compressed with Zstd via the Rust backend

#### Scenario: Browser export uses deflate
- **WHEN** a .fig file is exported in the browser
- **THEN** the payload is compressed with deflate as a fallback

### Requirement: Tauri native file dialogs
File Open and Save dialogs SHALL use Tauri's plugin-dialog for native OS dialogs on the desktop app. Save filters for .fig files.

#### Scenario: Native open dialog
- **WHEN** user presses ⌘O in the desktop app
- **THEN** the native OS file picker opens filtered for .fig files

#### Scenario: Native save dialog
- **WHEN** user selects Save As in the desktop app
- **THEN** the native OS save dialog opens with default filename "Untitled.fig"

### Requirement: Tier 1 rendering parity for import
The .fig import pipeline SHALL correctly import and render gradient fills, image fills, effects (shadows, blurs), stroke properties (cap, join, dash), and arc data.

#### Scenario: Import file with gradients
- **WHEN** a .fig file containing nodes with gradient fills is imported
- **THEN** all gradient types (linear, radial, angular, diamond) render correctly with their stops and transforms

### Requirement: .fig import/export round-trip
A .fig file imported and then exported SHALL produce a file that Figma can open with the same visual result.

#### Scenario: Round-trip fidelity
- **WHEN** a .fig file is imported into OpenPencil and re-exported
- **THEN** the exported file opens in Figma with matching visual output


### Requirement: Component type mapping in export
The .fig export pipeline SHALL map COMPONENT and COMPONENT_SET node types to SYMBOL in Kiwi encoding (Figma uses SYMBOL enum value for component-like nodes).

#### Scenario: Exporting component
- **WHEN** a COMPONENT node is serialized to Kiwi format
- **THEN** the type field uses the SYMBOL enum value

#### Scenario: Exporting component set
- **WHEN** a COMPONENT_SET node is serialized to Kiwi format
- **THEN** the type field uses the SYMBOL enum value

#### Scenario: Round-trip fidelity
- **WHEN** an exported .fig file is re-imported in Figma
- **THEN** component nodes are recognized as components (not unknown types)
