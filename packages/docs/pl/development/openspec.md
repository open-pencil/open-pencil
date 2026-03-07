# Workflow OpenSpec

OpenPencil używa OpenSpec do rozwoju opartego na specyfikacjach. Specyfikacje są źródłem prawdy.

## Struktura

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

## Bieżące specyfikacje

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

### 1. Zaproponuj zmianę

```
/opsx:propose change-name
```

→ proposal.md, design.md, specs/, tasks.md

### 2. Implementuj

```
/opsx:apply
```

### 3. Archiwizuj

```
/opsx:archive
```

## Format specyfikacji

```markdown
# capability-name Specification
## Requirements
### Requirement: Name
#### Scenario: Name
- **WHEN** condition
- **THEN** expected outcome
```

## Polecenia CLI

```sh
openspec list
openspec show <name>
openspec status --change <name>
openspec archive <name>
```
