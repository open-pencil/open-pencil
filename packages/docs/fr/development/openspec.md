# Workflow OpenSpec

OpenPencil utilise OpenSpec pour le développement piloté par les spécifications. Les spécifications sont la source de vérité.

## Structure

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

## Spécifications actuelles

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

### 1. Proposer une modification

```
/opsx:propose change-name
```

→ proposal.md, design.md, specs/, tasks.md

### 2. Implémenter

```
/opsx:apply
```

### 3. Archiver

```
/opsx:archive
```

## Format des spécifications

```markdown
# capability-name Specification
## Requirements
### Requirement: Name
#### Scenario: Name
- **WHEN** condition
- **THEN** expected outcome
```

## Commandes CLI

```sh
openspec list
openspec show <name>
openspec status --change <name>
openspec archive <name>
```
