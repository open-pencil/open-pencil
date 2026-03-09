# OpenSpec Workflow

OpenPencil uses [OpenSpec](https://github.com/Fission-AI/OpenSpec) for spec-driven development. Specifications are the source of truth for what the system does.

## Structure

```
openspec/
├── specs/              # Source of truth: how the system works now
│   ├── scene-graph/
│   │   └── spec.md
│   ├── canvas-rendering/
│   │   └── spec.md
│   ├── auto-layout/
│   │   └── spec.md
│   └── ...             # 19 capability specs total
├── changes/            # Proposed changes (one directory per change)
│   └── archive/        # Completed changes
└── config.yaml         # Optional configuration
```

## Current Specs

| Capability | Description |
|-----------|-------------|
| scene-graph | Flat Map storage, CRUD, hit testing |
| canvas-rendering | CanvasKit WASM rendering pipeline |
| canvas-navigation | Pan, zoom, hand tool |
| selection-manipulation | Click/marquee select, move, resize, rotate |
| undo-redo | Inverse-command pattern |
| text-editing | Text tool, Paragraph API, font loading |
| pen-tool | Vector network model, bezier curves |
| auto-layout | Yoga WASM flexbox, Shift+A toggle |
| figma-clipboard | Bidirectional Kiwi binary clipboard |
| fig-import | .fig file import pipeline |
| kiwi-codec | Kiwi binary codec, sparse field IDs |
| editor-ui | Vue 3 panels, toolbar, color picker |
| snap-guides | Edge/center snapping, rotation-aware |
| rulers | Canvas rulers, selection highlight |
| group-ungroup | <kbd>⌘</kbd><kbd>G</kbd> / <kbd>⇧</kbd><kbd>⌘</kbd><kbd>G</kbd>, position-based sort |
| desktop-app | Tauri v2, macOS menu bar |
| testing | Playwright E2E, bun:test unit |
| scrub-input | Drag-to-scrub numeric inputs |
| tooling | Vite 7, oxlint, oxfmt, tsgo, VitePress |

## Workflow

### 1. Propose a Change

```
/opsx:propose add-dark-mode
```

Creates `openspec/changes/add-dark-mode/` with:
- `proposal.md` — why and what changes
- `design.md` — technical approach
- `specs/` — delta specifications (ADDED/MODIFIED/REMOVED requirements)
- `tasks.md` — implementation checklist

### 2. Implement

```
/opsx:apply
```

Execute tasks from tasks.md, checking off items as they're completed.

### 3. Archive

```
/opsx:archive
```

- Merges delta specs into `openspec/specs/` (the baseline)
- Moves the change to `openspec/changes/archive/`

## Spec Format

Each spec file follows a consistent structure:

```markdown
# capability-name Specification

## Purpose
One-line description of what this capability does.

## Requirements

### Requirement: Name
Description using SHALL/MUST for normative requirements.

#### Scenario: Name
- **WHEN** condition
- **THEN** expected outcome
```

Every requirement has at least one scenario. Scenarios are potential test cases.

## CLI Commands

```sh
openspec list                    # List active changes
openspec show <name>             # Show change details
openspec status --change <name>  # Artifact status
openspec archive <name>          # Archive completed change
openspec update                  # Regenerate skills/prompts
```
