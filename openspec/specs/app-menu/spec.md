# app-menu Specification

## Purpose
Browser-mode menu bar (`src/components/AppMenu.vue`) with File, Edit, View, Object, Text, and Arrange menus. Uses reka-ui Menubar components. Only visible when `!IS_TAURI` (Tauri provides native menus).

## Requirements

### Requirement: App menu bar for browser mode

The system SHALL display a menu bar in browser mode (`!IS_TAURI`) with File, Edit, View, Object, Text, and Arrange menus.

#### Scenario: Menu visibility in browser
- **WHEN** app runs in browser (not Tauri desktop)
- **THEN** system displays menu bar at top of window

#### Scenario: Menu hidden in Tauri
- **WHEN** app runs in Tauri desktop mode
- **THEN** system hides menu bar (Tauri provides native menus)

### Requirement: File menu

The system SHALL provide File menu with Open, Save, Save As, and Export actions.

#### Scenario: Open file
- **WHEN** user clicks File → Open… or presses ⌘O (Ctrl+O on Windows/Linux)
- **THEN** system opens file picker dialog

#### Scenario: Save file
- **WHEN** user clicks File → Save or presses ⌘S
- **THEN** system saves current document

#### Scenario: Save As
- **WHEN** user clicks File → Save as… or presses ⌘⇧S
- **THEN** system opens save dialog for new filename

#### Scenario: Export selection
- **WHEN** user clicks File → Export selection… or presses ⌘⇧E with selection
- **THEN** system exports selected nodes as PNG

#### Scenario: Export disabled when no selection
- **WHEN** user has no selection
- **THEN** system disables "Export selection…" menu item

### Requirement: Edit menu

The system SHALL provide Edit menu with undo, redo, clipboard, and selection actions.

#### Scenario: Undo
- **WHEN** user clicks Edit → Undo or presses ⌘Z
- **THEN** system reverts last action

#### Scenario: Redo
- **WHEN** user clicks Edit → Redo or presses ⌘⇧Z
- **THEN** system reapplies undone action

#### Scenario: Copy/Paste
- **WHEN** user clicks Edit → Copy (⌘C) or Paste (⌘V)
- **THEN** system performs clipboard operation

#### Scenario: Duplicate
- **WHEN** user clicks Edit → Duplicate or presses ⌘D
- **THEN** system duplicates selected nodes

#### Scenario: Delete
- **WHEN** user clicks Edit → Delete or presses ⌫
- **THEN** system removes selected nodes

#### Scenario: Select all
- **WHEN** user clicks Edit → Select all or presses ⌘A
- **THEN** system selects all nodes on current page

### Requirement: View menu

The system SHALL provide View menu with zoom and ruler controls.

#### Scenario: Zoom to fit
- **WHEN** user clicks View → Zoom to fit or presses ⇧1
- **THEN** system fits all content in viewport

#### Scenario: Zoom in
- **WHEN** user clicks View → Zoom in or presses ⌘=
- **THEN** system zooms in toward center

#### Scenario: Zoom out
- **WHEN** user clicks View → Zoom out or presses ⌘-
- **THEN** system zooms out from center

#### Scenario: Toggle rulers
- **WHEN** user clicks View → Rulers or presses ⇧R
- **THEN** system shows/hides canvas rulers

### Requirement: Object menu

The system SHALL provide Object menu with grouping, framing, and component actions.

#### Scenario: Group selection
- **WHEN** user clicks Object → Group or presses ⌘G
- **THEN** system creates GROUP containing selected nodes

#### Scenario: Ungroup
- **WHEN** user clicks Object → Ungroup or presses ⌘⇧G with grouped selection
- **THEN** system dissolves group and reparents children

#### Scenario: Frame selection
- **WHEN** user clicks Object → Frame selection or presses ⌘⌥F
- **THEN** system wraps selected nodes in FRAME

#### Scenario: Create component
- **WHEN** user clicks Object → Create component or presses ⌘⌥K
- **THEN** system converts selection to COMPONENT

#### Scenario: Create component set
- **WHEN** user clicks Object → Create component set with multiple components selected
- **THEN** system creates COMPONENT_SET containing components

### Requirement: Text menu

The system SHALL provide Text menu with font size and style controls.

#### Scenario: Font size adjustment
- **WHEN** user clicks Text → Increase font size (⌘⇧>) or Decrease (⌘⇧<)
- **THEN** system adjusts font size of selected text by 2px

#### Scenario: Bold toggle
- **WHEN** user clicks Text → Bold or presses ⌘B
- **THEN** system toggles bold weight for selected text

#### Scenario: Italic toggle
- **WHEN** user clicks Text → Italic or presses ⌘I
- **THEN** system toggles italic style for selected text

#### Scenario: Underline toggle
- **WHEN** user clicks Text → Underline or presses ⌘U
- **THEN** system toggles underline decoration for selected text

#### Scenario: Strikethrough toggle
- **WHEN** user clicks Text → Strikethrough or presses S button
- **THEN** system toggles strikethrough decoration for selected text

#### Scenario: Text alignment submenu
- **WHEN** user clicks Text → Align → Left/Center/Right
- **THEN** system aligns selected text horizontally

### Requirement: Arrange menu

The system SHALL provide Arrange menu with z-order controls.

#### Scenario: Bring to front
- **WHEN** user clicks Arrange → Bring to front or presses ]
- **THEN** system moves selected node to top of parent's children

#### Scenario: Send to back
- **WHEN** user clicks Arrange → Send to back or presses [
- **THEN** system moves selected node to bottom of parent's children

#### Scenario: Bring forward
- **WHEN** user clicks Arrange → Bring forward
- **THEN** system moves selected node up one position

#### Scenario: Send backward
- **WHEN** user clicks Arrange → Send backward
- **THEN** system moves selected node down one position

### Requirement: Keyboard shortcut display

The system SHALL display keyboard shortcuts next to menu items.

#### Scenario: Platform-specific modifier
- **WHEN** app runs on Mac
- **THEN** system displays ⌘ for Command key

#### Scenario: Windows/Linux modifiers
- **WHEN** app runs on Windows or Linux
- **THEN** system displays Ctrl+ for Control key

### Requirement: reka-ui integration

The system SHALL use reka-ui Menubar components for menu implementation.

#### Scenario: Menu structure
- **WHEN** component renders
- **THEN** system uses MenubarRoot, MenubarMenu, MenubarTrigger, MenubarContent, MenubarItem

#### Scenario: Submenus
- **WHEN** menu has nested items (e.g., Text → Align)
- **THEN** system uses MenubarSub, MenubarSubTrigger, MenubarSubContent

#### Scenario: Separators
- **WHEN** menu defines separator: true
- **THEN** system renders MenubarSeparator divider

### Requirement: Action binding

The system SHALL bind menu actions to editor store methods.

#### Scenario: Calling store actions
- **WHEN** user selects menu item
- **THEN** system invokes corresponding method on useEditorStore (e.g., `store.saveFigFile()`, `store.duplicateSelected()`)

### Requirement: Dynamic disabled state

The system SHALL disable menu items based on current editor state.

#### Scenario: Export requires selection
- **WHEN** no nodes are selected
- **THEN** system disables "Export selection…" item

#### Scenario: Text menu requires text selection
- **WHEN** selected node is not TEXT
- **THEN** system may disable text formatting items (if implemented)
