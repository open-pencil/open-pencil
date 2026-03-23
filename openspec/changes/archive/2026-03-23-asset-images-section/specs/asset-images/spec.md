## ADDED Requirements

### Requirement: Images section lists all unique images in document
The Assets panel SHALL include a collapsible "Images" section showing all unique images from `graph.images`. Each entry shows a thumbnail, the names of nodes using it, and a usage count. The section header shows "Images (N)" where N is the total unique image count.

#### Scenario: Document with images
- **WHEN** the document has 3 unique images (2 used by multiple nodes)
- **THEN** the Images section header shows "Images (3)" and lists 3 image entries

#### Scenario: Document with no images
- **WHEN** `graph.images` is empty
- **THEN** the Images section is hidden entirely

### Requirement: Image thumbnail from raw bytes
Each image entry SHALL display a thumbnail generated as a blob URL from the raw image bytes stored in `graph.images`. The MIME type SHALL be detected from magic bytes (PNG, JPEG, WEBP). Blob URLs SHALL be revoked when the image list changes or on component dispose.

#### Scenario: PNG image thumbnail
- **WHEN** an image with PNG magic bytes exists in graph.images
- **THEN** a blob URL with type `image/png` is created and displayed as thumbnail

### Requirement: Image usage count and node names
Each image entry SHALL show the count of nodes referencing it and the names of the first few referencing nodes (truncated if many). Usage is determined by scanning all node fills for `type === 'IMAGE'` with matching `imageHash`.

#### Scenario: Image used by 3 nodes
- **WHEN** imageHash "abc123" is referenced by nodes "Photo", "Background", "Hero"
- **THEN** the entry shows "3 uses" and lists "Photo, Background, Hero"

### Requirement: Click image selects referencing nodes
Clicking an image entry SHALL select all nodes on the current page that reference that imageHash.

#### Scenario: Click selects nodes on current page
- **WHEN** user clicks an image used by "Photo" on Page 1 and "Hero" on Page 2, while viewing Page 1
- **THEN** only "Photo" is selected

### Requirement: Drag image to canvas creates rectangle with image fill
Dragging an image entry from the Assets panel onto the canvas SHALL create a new RECTANGLE node with an IMAGE fill at the drop position. The drag uses MIME type `application/x-openpencil-image-asset` with the imageHash as data.

#### Scenario: Drag image to canvas
- **WHEN** user drags an image entry and drops at (400, 300) on canvas
- **THEN** a RECTANGLE with IMAGE fill referencing that hash is created at canvas coordinates

### Requirement: Image search by node name
The search input SHALL filter images by the names of nodes that reference them. If any referencing node's name matches the query, the image entry is shown.

#### Scenario: Search finds image by node name
- **WHEN** user types "hero" and a node named "Hero Image" uses imageHash "xyz"
- **THEN** the image entry for "xyz" appears in filtered results
