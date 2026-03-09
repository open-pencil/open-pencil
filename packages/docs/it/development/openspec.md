# Workflow OpenSpec

OpenPencil usa OpenSpec per lo sviluppo guidato da specifiche. Le specifiche sono la fonte di verità.

## Struttura

```
openspec/
├── specs/              # Source of truth
│   ├── scene-graph/
│   ├── canvas-rendering/
│   ├── auto-layout/
│   └── ...             # 19 capability specs
├── changes/
│   └── archive/
└── config.yaml
```

## Specifiche attuali

| Capability | Description |
|-----------|-------------|
| scene-graph | Flat Map, CRUD, hit testing |
| canvas-rendering | CanvasKit WASM rendering |
| auto-layout | Yoga WASM flexbox |
| fig-import | .fig file import |
| kiwi-codec | Kiwi binary codec |
| editor-ui | Vue 3 panels, toolbar |
| desktop-app | Tauri v2 |
| testing | Playwright + bun:test |
| tooling | Vite, oxlint, tsgo |

## Workflow

### 1. Proporre una modifica

```
/opsx:propose change-name
```

→ proposal.md, design.md, specs/, tasks.md

### 2. Implementare

```
/opsx:apply
```

### 3. Archiviare

```
/opsx:archive
```

## Formato delle specifiche

```markdown
# capability-name Specification
## Requirements
### Requirement: Name
#### Scenario: Name
- **WHEN** condition
- **THEN** expected outcome
```

## Comandi CLI

```sh
openspec list
openspec show <name>
openspec status --change <name>
openspec archive <name>
```
