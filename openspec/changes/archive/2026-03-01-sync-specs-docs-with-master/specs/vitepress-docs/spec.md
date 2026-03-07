## ADDED Requirements

### Requirement: Eval command documentation

The docs site SHALL include comprehensive documentation for the eval command in `docs/eval-command.md`.

#### Scenario: Eval command page exists
- **WHEN** user navigates to `/eval-command`
- **THEN** full documentation for `open-pencil eval` command is displayed

#### Scenario: Overview section
- **WHEN** user reads eval command docs
- **THEN** overview explains purpose (headless scripting with Figma Plugin API)

#### Scenario: Usage examples
- **WHEN** user reads eval command docs
- **THEN** code examples show `--code`, `--stdin`, `--write`, `-o`, `--json` usage

#### Scenario: Architecture section
- **WHEN** user reads eval command docs
- **THEN** architecture diagram shows CLI → loadDocument → FigmaAPI → execute → serialize flow

#### Scenario: FigmaAPI surface coverage
- **WHEN** user reads eval command docs
- **THEN** documentation lists supported methods (createFrame, createRectangle, findAll, etc.)

#### Scenario: AI integration examples
- **WHEN** user reads eval command docs
- **THEN** examples show how AI tools use eval for batch operations

#### Scenario: Testing patterns
- **WHEN** user reads eval command docs
- **THEN** examples show headless testing with eval

#### Scenario: Migration from Figma plugins
- **WHEN** user reads eval command docs
- **THEN** guide explains how to adapt Figma plugin code to eval scripts

#### Scenario: 437 lines of documentation
- **WHEN** eval-command.md is counted
- **THEN** it contains 437 lines of comprehensive content

### Requirement: Comparison matrix updates

The docs site SHALL update comparison matrices to reflect new features (app menu, eval command, Figma Plugin API).

#### Scenario: Figma comparison update
- **WHEN** user reads `docs/guide/figma-comparison.md`
- **THEN** Interface & Navigation section includes app menu status

#### Scenario: Plugin API row
- **WHEN** user reads Figma comparison
- **THEN** a row documents eval command with Figma Plugin API compatibility

#### Scenario: AI tools update
- **WHEN** user reads Figma comparison
- **THEN** AI tools row is updated to reflect unified tool definitions and eval integration

#### Scenario: Penpot comparison update
- **WHEN** user reads `docs/guide/comparison.md`
- **THEN** Architecture section highlights headless scripting advantage (eval command with Plugin API that Penpot lacks)

### Requirement: App menu documentation

The docs site SHALL document app menu in appropriate guide pages.

#### Scenario: App menu in features
- **WHEN** user reads Features page
- **THEN** app menu is listed with menus (File, Edit, View, Object, Text, Arrange) and key actions

#### Scenario: Browser mode distinction
- **WHEN** user reads app menu docs
- **THEN** clarification that menu bar only appears in browser mode (Tauri uses native menus)

### Requirement: Autosave documentation

The docs site SHALL document autosave behavior in appropriate guide pages.

#### Scenario: Autosave in features
- **WHEN** user reads Features page or Getting Started
- **THEN** autosave is explained (3-second debounce, automatic for files with handle)

#### Scenario: Autosave limitations
- **WHEN** user reads autosave docs
- **THEN** note that new unsaved files don't autosave until user performs Save As

### Requirement: AGENTS.md update reference

The docs site SHALL reference tool unification in development pages when relevant.

#### Scenario: Tool architecture mention
- **WHEN** user reads development/contributing docs
- **THEN** unified tool definitions (`packages/core/src/tools/`) are mentioned as canonical source
