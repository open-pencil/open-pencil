## ADDED Requirements

### Requirement: Pane registry per document
The system SHALL maintain a pane registry per document store with one shared document editor and one or more pane-local view states.

#### Scenario: Initial document creates one pane
- **WHEN** a document store is created
- **THEN** the system creates exactly one canvas pane in that document's pane registry
- **AND** the pane is the active pane
- **AND** the pane uses the document's initial page, viewport, and empty selection state

#### Scenario: Pane-local view state is independent
- **WHEN** two panes exist for the same document
- **THEN** each pane has independent current page, pan, zoom, viewport size, selection, hover, entered container, cursor, remote cursor projection, and transient overlay state
- **AND** the document graph, undo history, document IO, autosave, active tool, loading state, tabs, sidebars, toolbar, and collaboration room remain shared for that document

#### Scenario: Same document graph is shared
- **WHEN** a user creates, edits, moves, or deletes a node in one pane
- **THEN** the shared document graph is mutated once
- **AND** every pane showing the affected page repaints with the graph update

### Requirement: Recursive split pane tree
The system SHALL manage recursive horizontal and vertical split layouts without losing pane state.

#### Scenario: Split right creates horizontal split
- **WHEN** the user splits a pane to the right
- **THEN** the pane leaf is replaced by a horizontal split node
- **AND** the split contains the source pane and a new pane
- **AND** both pane IDs remain stable during later resizing

#### Scenario: Split down creates vertical split
- **WHEN** the user splits a pane downward
- **THEN** the pane leaf is replaced by a vertical split node
- **AND** the split contains the source pane and a new pane
- **AND** both pane IDs remain stable during later resizing

#### Scenario: New pane clones viewport but not selection
- **WHEN** a pane is split
- **THEN** the new pane starts on the source pane's current page
- **AND** the new pane starts with the source pane's pan and zoom
- **AND** the new pane starts with an empty selection

#### Scenario: Closing pane collapses split tree
- **WHEN** the user closes a pane and at least one other pane remains
- **THEN** the pane is removed from the split tree
- **AND** split parents with one remaining child are collapsed
- **AND** a remaining pane becomes active if the closed pane was active

#### Scenario: Closing last pane is refused
- **WHEN** the user attempts to close the only remaining pane
- **THEN** the system refuses the operation
- **AND** no split tree or pane state is mutated

### Requirement: Reka splitter rendering
The system SHALL render split canvas panes with Reka UI splitter primitives.

#### Scenario: Horizontal split renders Reka horizontal group
- **WHEN** a split node direction is horizontal
- **THEN** the UI renders a Reka `SplitterGroup` with `direction="horizontal"`
- **AND** the split children render as ordered `SplitterPanel` components separated by `SplitterResizeHandle`

#### Scenario: Vertical split renders Reka vertical group
- **WHEN** a split node direction is vertical
- **THEN** the UI renders a Reka `SplitterGroup` with `direction="vertical"`
- **AND** the split children render as ordered `SplitterPanel` components separated by `SplitterResizeHandle`

#### Scenario: Valid layout sizes are stored
- **WHEN** Reka emits a valid layout array for a split group
- **THEN** the system stores those sizes in the matching split node
- **AND** no pane IDs are recreated

#### Scenario: Invalid layout payload is ignored
- **WHEN** Reka emits an empty, wrong-length, negative, or non-finite layout array
- **THEN** the system keeps the previous split node sizes
- **AND** no pane state is recreated

### Requirement: Pane-aware rendering
The system SHALL render each pane from explicit pane render state rather than hidden global state swapping.

#### Scenario: Pane render uses composed state
- **WHEN** a pane canvas renders
- **THEN** it receives render state composed from shared document state and that pane's view state
- **AND** it does not read another pane's page, selection, pan, zoom, hover, cursor, or overlays

#### Scenario: Pane resize updates target pane only
- **WHEN** a pane canvas is resized by a splitter or viewport change
- **THEN** only that pane's viewport width and height are updated
- **AND** no other pane's viewport dimensions are overwritten

#### Scenario: Graph mutation invalidates all panes
- **WHEN** the shared document graph changes
- **THEN** every pane renderer for that document is invalidated
- **AND** every pane showing affected content repaints

#### Scenario: Pane-only viewport change repaints target pane
- **WHEN** the user pans or zooms one pane
- **THEN** only that pane's viewport state changes
- **AND** inactive panes keep their previous pan and zoom

### Requirement: Pane-bound input
The system SHALL process canvas input against the source pane.

#### Scenario: Pointer input activates source pane
- **WHEN** the user pointer-downs in a pane
- **THEN** the system activates that pane before processing selection, drag, resize, text, pen, node-edit, or other input

#### Scenario: Panning one pane does not pan another
- **WHEN** two panes display the same page
- **AND** the user pans one pane
- **THEN** only that pane's pan changes
- **AND** the other pane keeps its previous viewport state

#### Scenario: Selecting in one pane does not select in another
- **WHEN** two panes exist
- **AND** the user selects nodes in one pane
- **THEN** only that pane's selection changes
- **AND** inactive panes keep their previous selection unless graph changes invalidate selected IDs

#### Scenario: Switching page affects active pane only
- **WHEN** two panes exist
- **AND** the user switches page through page UI or command
- **THEN** only the active pane's current page changes
- **AND** inactive panes keep their current pages

### Requirement: Long-running interaction cleanup
The system SHALL commit or cancel pane-owned interactions when pane context changes according to the cleanup policy defined by interaction type.

#### Scenario: Active pane changes during text edit
- **WHEN** a pane owns an active text editing session
- **AND** the user activates another pane
- **THEN** the system commits the text edit before changing the active pane
- **AND** no caret or text edit state remains attached to the inactive editing pane after commit

#### Scenario: Pane closes during interaction
- **WHEN** a pane with active drag, marquee, resize, rotation, pen, node-edit, vector-edit, text edit, or auto-layout padding edit is closed
- **THEN** text edit and finite auto-layout padding edits are committed before close
- **AND** marquee, drop indicators, uncommitted pen paths, and preview-only transform or edit drags are canceled or cleared
- **AND** no interaction state remains attached to the closed pane

#### Scenario: Graph replacement sanitizes pane state
- **WHEN** the document graph is replaced or reloaded
- **THEN** every pane points to a valid page
- **AND** pane-local selection, hover, cursor, and overlay IDs that no longer exist are cleared

### Requirement: Active-pane singleton routing
The system SHALL route singleton UI and commands through the active pane for pane-sensitive behavior.

#### Scenario: Properties panel follows active pane selection
- **WHEN** two panes have different selections
- **AND** the user activates one pane
- **THEN** the properties panel displays the active pane's selected node state

#### Scenario: Layers and page UI follow active pane
- **WHEN** the active pane changes
- **THEN** the layer tree displays the active pane's current page
- **AND** layer selection highlights the active pane's selection
- **AND** the page list marks the active pane's current page

#### Scenario: Keyboard shortcut targets active pane
- **WHEN** two panes exist
- **AND** the user invokes a pane-sensitive keyboard shortcut
- **THEN** the command applies to the active pane
- **AND** inactive pane-local state is not changed by that command

#### Scenario: Clipboard paste uses active pane target
- **WHEN** the user pastes content without an explicit cursor target
- **THEN** the paste target is the active pane cursor if available
- **AND** otherwise the paste target is the active pane viewport center

#### Scenario: Export defaults use active pane
- **WHEN** the user exports without passing an explicit target
- **THEN** the export target is the active pane selection if non-empty
- **AND** otherwise the export target is the active pane current page

### Requirement: Collaboration projection per pane
The system SHALL keep the collaboration room shared per document and derive pane-local presence rendering.

#### Scenario: Local awareness uses active pane
- **WHEN** the document is connected to a collaboration room
- **AND** the user moves the cursor or changes selection in the active pane
- **THEN** local awareness broadcasts the active pane's cursor, page, zoom, and selection for that document

#### Scenario: Remote cursors are filtered by pane page
- **WHEN** remote peer cursor data is available for the document
- **THEN** each pane renders remote cursors whose peer page matches that pane's current page
- **AND** panes on other pages do not render those remote cursors

#### Scenario: Pane switching does not reconnect collaboration
- **WHEN** the user switches active pane within a connected document
- **THEN** the collaboration room remains connected
- **AND** the room is not disconnected or recreated because of pane activation

### Requirement: Visible pane resource cap
The system SHALL enforce an initial visible pane cap of 4 for one document on non-mobile layouts and SHALL keep mobile single-pane-only in the first slice.

#### Scenario: Split action disabled at pane cap
- **WHEN** the document already has 4 visible panes
- **AND** the user attempts to split another pane
- **THEN** the split action is disabled or returns a clear no-op result
- **AND** no partial pane, split node, or canvas is created

#### Scenario: Mobile remains single pane
- **WHEN** the editor is in mobile layout
- **THEN** split controls are not exposed in the first slice
- **AND** the split root renders or recovers to one visible pane

#### Scenario: Closing pane disposes canvas resources
- **WHEN** a pane is closed
- **THEN** its canvas surfaces and renderers are disposed through existing canvas lifecycle cleanup
- **AND** remaining panes continue rendering
