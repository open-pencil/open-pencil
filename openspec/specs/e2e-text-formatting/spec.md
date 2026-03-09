# e2e-text-formatting Specification

## Purpose
TBD - created by archiving change e2e-coverage-gaps. Update Purpose after archive.
## Requirements
### Requirement: Text cursor positioning E2E
The E2E suite SHALL verify that clicking inside a text node in edit mode positions the cursor near the clicked glyph.

#### Scenario: Click positions cursor
- **WHEN** a text node is double-clicked to enter edit mode and then a position inside the text is clicked
- **THEN** the text node remains in edit mode without errors

### Requirement: Text word selection E2E
The E2E suite SHALL verify that double-clicking on a word selects that word.

#### Scenario: Double-click selects word
- **WHEN** a text node is in edit mode and a word is double-clicked
- **THEN** the canvas screenshot shows the word highlighted (differs from no-selection screenshot)

### Requirement: Bold shortcut E2E
The E2E suite SHALL verify that ⌘B toggles bold formatting on selected text.

#### Scenario: Cmd+B toggles bold
- **WHEN** a text node is in edit mode, all text is selected, and ⌘B is pressed
- **THEN** `node.fontWeight` changes to 700 (bold) or back to 400 (normal)

### Requirement: Italic shortcut E2E
The E2E suite SHALL verify that ⌘I toggles italic formatting on selected text.

#### Scenario: Cmd+I toggles italic
- **WHEN** a text node is in edit mode with all text selected and ⌘I is pressed
- **THEN** `node.italic` toggles to the opposite boolean

### Requirement: Word navigation shortcut E2E
The E2E suite SHALL verify that Alt+ArrowRight moves the cursor by one word.

#### Scenario: Alt+ArrowRight moves by word
- **WHEN** a text node is in edit mode with cursor at position 0 and Alt+ArrowRight is pressed
- **THEN** no JavaScript errors are thrown and the editor remains in text mode

### Requirement: Typography section buttons E2E
The E2E suite SHALL verify that the Bold button in the typography section applies formatting.

#### Scenario: Bold button in panel toggles bold
- **WHEN** a text node is selected (not in edit mode) and the Bold button in DesignPanel is clicked
- **THEN** `node.fontWeight` changes

