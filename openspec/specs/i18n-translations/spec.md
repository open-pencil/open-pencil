# i18n-translations Specification

## Purpose
TBD - created by archiving change add-i18n-support. Update Purpose after archive.
## Requirements
### Requirement: Menu translations
The system SHALL translate all AppMenu text including menu items, submenus, and shortcuts.

#### Scenario: File menu translations
- **WHEN** user views File menu
- **THEN** following items SHALL be translated:
  - "New"
  - "Open…"
  - "Save"
  - "Save as…"
  - "Export selection…"
  - "Auto-save to local file"

#### Scenario: Edit menu translations
- **WHEN** user views Edit menu
- **THEN** following items SHALL be translated:
  - "Undo"
  - "Redo"
  - "Copy"
  - "Paste"
  - "Duplicate"
  - "Delete"
  - "Select all"
  - "Find/Replace"

#### Scenario: View menu translations
- **WHEN** user views View menu
- **THEN** following items SHALL be translated:
  - "Zoom in"
  - "Zoom out"
  - "Zoom to 100%"
  - "Zoom to fit"
  - "Toggle rulers"
  - "Toggle grid"

### Requirement: Toolbar translations
The system SHALL translate all Toolbar tool labels and action buttons.

#### Scenario: Tool labels translations
- **WHEN** user views Toolbar
- **THEN** following tool labels SHALL be translated:
  - "Move" (Select tool)
  - "Frame"
  - "Section"
  - "Rectangle"
  - "Ellipse"
  - "Line"
  - "Polygon"
  - "Star"
  - "Pen"
  - "Text"
  - "Hand"

#### Scenario: Edit actions translations
- **WHEN** user views edit actions dropdown
- **THEN** following labels SHALL be translated:
  - "Copy"
  - "Paste"
  - "Cut"
  - "Duplicate"
  - "Delete"

#### Scenario: Arrange actions translations
- **WHEN** user views arrange actions dropdown
- **THEN** following labels SHALL be translated:
  - "Front" (Bring to front)
  - "Back" (Send to back)
  - "Group"
  - "Ungroup"
  - "Lock"

### Requirement: Properties panel translations
The system SHALL translate all Properties panel text including tab names and section labels.

#### Scenario: Tab names translations
- **WHEN** user views Properties panel tabs
- **THEN** following tab names SHALL be translated:
  - "Design"
  - "Code"
  - "AI"

#### Scenario: Layout section translations
- **WHEN** user views Layout section
- **THEN** following labels SHALL be translated:
  - "Width"
  - "Height"
  - "Auto layout"
  - "Horizontal"
  - "Vertical"
  - "Grid"
  - "Gap"
  - "Padding"
  - "Top"
  - "Right"
  - "Bottom"
  - "Left"
  - "Wrap"
  - "Align"
  - "Space between"

#### Scenario: Appearance section translations
- **WHEN** user views Appearance section
- **THEN** following labels SHALL be translated:
  - "Fill"
  - "Stroke"
  - "Effects"
  - "Corner radius"
  - "Opacity"
  - "Blend mode"

#### Scenario: Typography section translations
- **WHEN** user views Typography section
- **THEN** following labels SHALL be translated:
  - "Font"
  - "Size"
  - "Weight"
  - "Line height"
  - "Letter spacing"
  - "Text align"
  - "Decoration"

#### Scenario: Position section translations
- **WHEN** user views Position section
- **THEN** following labels SHALL be translated:
  - "X"
  - "Y"
  - "Rotation"
  - "Flip"

### Requirement: Panels translations
The system SHALL translate all side panel headers and controls.

#### Scenario: Layers panel translations
- **WHEN** user views Layers panel
- **THEN** following text SHALL be translated:
  - "Layers" (panel header)

#### Scenario: Pages panel translations
- **WHEN** user views Pages panel
- **THEN** following text SHALL be translated:
  - "Pages" (panel header)
  - "Add page" (button title)

#### Scenario: Variables dialog translations
- **WHEN** user views Variables dialog
- **THEN** following text SHALL be translated:
  - "Variables" (dialog title)
  - "Rename collection"
  - "Rename variable"
  - "Change variable value"
  - "Add mode"
  - "Delete mode"
  - "Add variable"
  - "Delete variable"

### Requirement: Context menu translations
The system SHALL translate all context menu items.

#### Scenario: Node context menu translations
- **WHEN** user right-clicks on a node
- **THEN** following menu items SHALL be translated:
  - "Copy"
  - "Paste"
  - "Duplicate"
  - "Delete"
  - "Group"
  - "Ungroup"
  - "Bring to front"
  - "Send to back"
  - "Lock"
  - "Unlock"
  - "Create component"

#### Scenario: Canvas context menu translations
- **WHEN** user right-clicks on canvas
- **THEN** following menu items SHALL be translated:
  - "Paste here"
  - "Select all"

### Requirement: Chat/AI panel translations
The system SHALL translate all AI chat interface text.

#### Scenario: Chat input translations
- **WHEN** user views Chat panel
- **THEN** following text SHALL be translated:
  - "Ask AI to design..."
  - "Send"
  - "Cancel"

#### Scenario: Provider setup translations
- **WHEN** user views provider setup
- **THEN** following text SHALL be translated:
  - "Select a provider"
  - "API Key"
  - "Connect"
  - "Disconnect"

### Requirement: Toast and error messages translations
The system SHALL translate all toast notifications and error messages.

#### Scenario: Success messages translations
- **WHEN** system shows success toast
- **THEN** messages like "Saved", "Exported", "Copied" SHALL be translated

#### Scenario: Error messages translations
- **WHEN** system shows error toast
- **THEN** messages like "Failed to save", "Failed to export", "Connection error" SHALL be translated

### Requirement: Dialog translations
The system SHALL translate all dialog text.

#### Scenario: Confirm dialog translations
- **WHEN** system shows confirm dialog
- **THEN** following text SHALL be translated:
  - "Confirm"
  - "Cancel"
  - "OK"
  - "Delete"
  - "Are you sure?"
  - "This action cannot be undone"

#### Scenario: Permission dialog translations
- **WHEN** system shows ACP permission dialog
- **THEN** following text SHALL be translated:
  - "Permission Request"
  - "Allow"
  - "Deny"
  - "The agent requests permission to..."

### Requirement: Keyboard shortcuts hint
The system SHALL display keyboard shortcuts in a locale-independent format.

#### Scenario: Shortcut display
- **WHEN** menu item has a shortcut
- **THEN** shortcut SHALL display using symbols:
  - macOS: ⌘, ⇧, ⌥, ⌃
  - Windows/Linux: Ctrl, Shift, Alt
- **AND** shortcuts SHALL NOT be translated

### Requirement: Empty states translations
The system SHALL translate all empty state messages.

#### Scenario: No selection state
- **WHEN** no node is selected
- **THEN** empty state message SHALL be translated

#### Scenario: No pages state
- **WHEN** document has no pages
- **THEN** "No pages" message SHALL be translated

### Requirement: Tooltip translations
The system SHALL translate all tooltip text.

#### Scenario: Button tooltips
- **WHEN** user hovers over a button
- **THEN** tooltip text SHALL be translated in current locale

