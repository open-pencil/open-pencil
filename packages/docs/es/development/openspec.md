# Flujo OpenSpec

OpenPencil usa OpenSpec para desarrollo dirigido por especificaciones. Las especificaciones son la fuente de verdad.

## Estructura

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

## Especificaciones actuales

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

## Flujo de trabajo

### 1. Proponer un cambio

```
/opsx:propose change-name
```

→ proposal.md, design.md, specs/, tasks.md

### 2. Implementar

```
/opsx:apply
```

### 3. Archivar

```
/opsx:archive
```

## Formato de especificaciones

```markdown
# capability-name Specification
## Requirements
### Requirement: Name
#### Scenario: Name
- **WHEN** condition
- **THEN** expected outcome
```

## Comandos CLI

```sh
openspec list
openspec show <name>
openspec status --change <name>
openspec archive <name>
```
