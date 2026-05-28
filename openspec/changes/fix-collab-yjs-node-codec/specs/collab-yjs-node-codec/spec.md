## ADDED Requirements

### Requirement: Collaboration-safe node encoding
The system SHALL encode shared scene graph node data for Yjs through an explicit collaboration-safe node codec instead of relying on a drifting JSON parse allow-list.

#### Scenario: Object fields round-trip through the codec
- **WHEN** a scene node with object-valued graph fields is synchronized to Yjs and decoded by another peer
- **THEN** the decoded properties MUST preserve runtime-compatible values for shared graph fields such as fills, strokes, effects, style runs, vector network, source metadata, and geometry fields

#### Scenario: Pane-local state is not encoded
- **WHEN** a node is synchronized through the collaboration codec while split panes are open
- **THEN** pane-local page, viewport, selection, hover, cursor, interaction, and render state MUST NOT be included in the encoded node payload

### Requirement: Source metadata remains valid after remote sync
The system SHALL ensure decoded remote node props contain valid source metadata shape before applying them to the scene graph.

#### Scenario: Missing source metadata is normalized
- **WHEN** a remote Yjs node payload omits source metadata or contains partial source metadata
- **THEN** applying the payload to the graph MUST NOT throw while clearing edited source metadata
- **AND** the receiving node MUST have a valid `source.fig` object with default raw metadata fields

#### Scenario: Existing imported source metadata is preserved
- **WHEN** a remote Yjs node payload includes imported Figma source metadata
- **THEN** decoding and applying the payload MUST preserve raw size, raw transform, raw node fields, layout metadata, and component or symbol metadata present in the payload

### Requirement: Geometry payloads remain typed
The system SHALL preserve valid geometry payloads as typed `Uint8Array` command blobs across collaboration synchronization.

#### Scenario: Geometry command blobs decode as Uint8Array
- **WHEN** a remote Yjs node payload includes fill or stroke geometry command data
- **THEN** decoded `fillGeometry` and `strokeGeometry` entries with command data MUST expose `commandsBlob` as `Uint8Array`

#### Scenario: Malformed geometry does not crash rendering
- **WHEN** a remote or imported node contains malformed geometry entries without valid command blobs
- **THEN** bounds computation and CanvasKit path generation MUST skip those entries instead of throwing

### Requirement: Binary image resources remain separate
The system SHALL keep image bytes synchronized through the existing collaboration image resource map while preserving node fill references to those resources.

#### Scenario: Image fill reference is preserved
- **WHEN** a node with an image fill is synchronized to Yjs
- **THEN** the node payload MUST preserve the fill's `imageHash`
- **AND** the existing image resource synchronization MUST remain able to send the referenced bytes through the image map

### Requirement: Remote graph updates do not echo
The system SHALL preserve existing graph/Yjs suppress semantics when applying decoded remote node props.

#### Scenario: Applying remote node update does not resync immediately
- **WHEN** a Yjs observer applies a remote node update to the local scene graph
- **THEN** the graph update MUST NOT be echoed back as a new local Yjs node synchronization transaction

#### Scenario: Local sync still works after remote application
- **WHEN** a remote Yjs update has been applied to the local scene graph
- **AND** the local user later edits a node
- **THEN** the local graph edit MUST still synchronize to Yjs

### Requirement: Remote node creation is graph-compatible
The system SHALL apply remote-created nodes with valid shared graph state on receiving peers.

#### Scenario: Remote rectangle creation succeeds
- **WHEN** one peer creates a rectangle and the Yjs node payload is applied on another peer
- **THEN** the receiving graph MUST create or update the node without source metadata or geometry runtime errors
- **AND** the receiving renderer MUST be able to render the document

#### Scenario: Remote node placement is preserved
- **WHEN** a remote-created node payload is applied on another peer
- **THEN** the receiving graph MUST preserve the node id, parent id, page or frame containment, and child ordering from the payload

#### Scenario: Remote vector creation preserves vector data
- **WHEN** one peer creates or updates a vector node with vector network data
- **THEN** the receiving graph MUST decode vector data into runtime-compatible vector network objects

### Requirement: Legacy Yjs payloads remain readable
The system SHALL tolerate node payload fields that were encoded by the previous JSON-string-based collaboration format during an active session.

#### Scenario: Legacy stringified object field decodes
- **WHEN** a Yjs node payload contains a legacy JSON string for a supported object field such as fills, strokes, effects, style runs, vector network, source metadata, or geometry
- **THEN** the codec MUST decode the field into runtime-compatible graph values where valid

### Requirement: Image resource ordering is tolerated
The system SHALL tolerate image-filled node payloads arriving before their referenced image bytes.

#### Scenario: Image node arrives before image bytes
- **WHEN** a remote node with an image fill references an image hash that is not yet present in the local image map
- **THEN** applying and rendering the node MUST NOT throw
- **AND** the image fill MUST be able to resolve after the image map receives the referenced bytes
