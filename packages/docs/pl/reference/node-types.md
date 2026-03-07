# Typy węzłów

The scene graph supports 28 node types from Figma's Kiwi schema. Each node is identified by a GUID (`sessionID:localID`) and has a parent reference via `parentIndex`. The OpenPencil engine's `NodeType` union currently uses 17 of these types.

## Type Table

28 Figma schema types + 1 synthetic engine type. Types marked ✅ are in the engine's `NodeType` union (17 total).

| Type | ID | Description | Engine |
|------|----|-------------|--------|
| DOCUMENT | 1 | Root node, one per file | — |
| CANVAS | 2 | Page | ✅ |
| GROUP | 3 | Group container | ✅ |
| FRAME | 4 | Primary container (artboard), supports auto-layout | ✅ |
| BOOLEAN_OPERATION | 5 | Union/subtract/intersect/exclude result | |
| VECTOR | 6 | Freeform vector path | ✅ |
| STAR | 7 | Star shape | ✅ |
| LINE | 8 | Line | ✅ |
| ELLIPSE | 9 | Ellipse/circle, supports arc data | ✅ |
| RECTANGLE | 10 | Rectangle | ✅ |
| REGULAR_POLYGON | 11 | Regular polygon (3–12 sides, engine uses `POLYGON`) | ✅ |
| ROUNDED_RECTANGLE | 12 | Rectangle with smooth corners | ✅ |
| TEXT | 13 | Text with rich formatting | ✅ |
| SLICE | 14 | Export region | |
| SYMBOL | 15 | Component (main, engine uses `COMPONENT`) | ✅ |
| INSTANCE | 16 | Component instance | ✅ |
| STICKY | 17 | FigJam sticky note | |
| SHAPE_WITH_TEXT | 18 | FigJam shape | ✅ |
| CONNECTOR | 19 | Connector line between nodes | ✅ |
| CODE_BLOCK | 20 | FigJam code block | |
| WIDGET | 21 | Plugin widget | |
| STAMP | 22 | FigJam stamp | |
| MEDIA | 23 | Video/GIF | |
| HIGHLIGHT | 24 | FigJam highlight | |
| SECTION | 25 | Canvas section (organizational, top-level only) | ✅ |
| SECTION_OVERLAY | 26 | Section overlay | |
| WASHI_TAPE | 27 | FigJam washi tape | |
| VARIABLE | 28 | Variable definition node | |
| COMPONENT_SET | — | Variant group container (synthetic, mapped from SYMBOL) | ✅ |

### Engine NodeType Union (17 types)

The engine's `NodeType` uses simplified names. Some differ from the Kiwi schema:
- `COMPONENT` → Kiwi `SYMBOL` (ID 15)
- `COMPONENT_SET` → variant group container (no dedicated Kiwi ID, mapped from SYMBOL with variants)
- `POLYGON` → Kiwi `REGULAR_POLYGON` (ID 11)

```typescript
type NodeType =
  | 'CANVAS' | 'FRAME' | 'RECTANGLE' | 'ROUNDED_RECTANGLE'
  | 'ELLIPSE' | 'TEXT' | 'LINE' | 'STAR' | 'POLYGON'
  | 'VECTOR' | 'GROUP' | 'SECTION'
  | 'COMPONENT' | 'COMPONENT_SET' | 'INSTANCE'
  | 'CONNECTOR' | 'SHAPE_WITH_TEXT'
```

## Node Hierarchy

```
Document
├── Canvas (Page 1)
│   ├── Section (top-level only, title pill, auto-adopts siblings)
│   │   ├── Frame
│   │   │   └── ...children
│   │   └── Rectangle
│   ├── Frame
│   │   ├── Rectangle
│   │   ├── Text
│   │   └── Frame (nested)
│   │       ├── Ellipse
│   │       └── Instance (→ references Component)
│   ├── Component
│   │   └── ...children
│   ├── Group
│   │   └── ...children
│   └── BooleanOperation
│       └── ...operand shapes
└── Canvas (Page 2)
    └── ...
```

## Core Properties

Every node carries these fields (subset of NodeChange):

### Identity & Tree

- `guid` — unique identifier (`sessionID:localID`)
- `type` — node type enum
- `name` — display name
- `phase` — CREATED or REMOVED
- `parentIndex` — parent GUID + position string for z-ordering

### Transform

- `size` — width/height vector
- `transform` — 2×3 affine matrix
- `rotation` — degrees

### Appearance

- `fillPaints[]` — fill colors/gradients/images
- `strokePaints[]` — stroke colors
- `effects[]` — shadows, blurs
- `opacity` — 0–1
- `blendMode` — NORMAL, MULTIPLY, SCREEN, etc.

### Stroke

- `strokeWeight` — stroke thickness
- `strokeAlign` — inside / center / outside
- `strokeCap` — butt / round / square
- `strokeJoin` — miter / bevel / round
- `dashPattern[]` — dash/gap lengths

### Corners

- `cornerRadius` — uniform radius
- `cornerSmoothing` — squircle amount (0–1)
- Per-corner radii when `rectangleCornerRadiiIndependent` is true

### Visibility

- `visible` — show/hide
- `locked` — prevent editing

## Type-Specific Properties

### Text

`fontSize`, `fontName`, `lineHeight`, `letterSpacing`, `textAlignHorizontal`, `textAlignVertical`, `textAutoResize`, `textData` (characters, style overrides, baselines, glyphs)

### Vector

`vectorData` (vectorNetworkBlob, normalizedSize), `fillGeometry[]`, `strokeGeometry[]`, `handleMirroring`, `arcData`

### Layout (Frame)

`stackMode`, `stackSpacing`, `stackPadding`, `stackJustify`, `stackCounterAlign`, `stackPrimarySizing`, `stackCounterSizing`, `stackChildPrimaryGrow`, `stackChildAlignSelf`

### Component

`symbolData`, `componentKey`, `componentPropDefs[]`, `symbolDescription`

### Instance

`overriddenSymbolID`, `symbolData.symbolOverrides[]`, `componentPropRefs[]`, `componentPropAssignments[]`

## Paint

```typescript
interface Fill {
  type: 'SOLID' | 'GRADIENT_LINEAR' | 'GRADIENT_RADIAL' |
        'GRADIENT_ANGULAR' | 'GRADIENT_DIAMOND' | 'IMAGE'
  color: Color              // {r, g, b, a} 0–1 floats
  opacity: number           // 0–1
  visible: boolean
  blendMode?: BlendMode
  gradientStops?: GradientStop[]     // for gradients
  gradientTransform?: GradientTransform  // 2×3 matrix
  imageHash?: string        // for image fills
  imageScaleMode?: 'FILL' | 'FIT' | 'CROP' | 'TILE'
  imageTransform?: GradientTransform
}
```

## Effect

```typescript
interface Effect {
  type: 'DROP_SHADOW' | 'INNER_SHADOW' | 'LAYER_BLUR' |
        'BACKGROUND_BLUR' | 'FOREGROUND_BLUR'
  color: Color
  offset: { x: number; y: number }
  radius: number
  spread: number
  visible: boolean
}
```

## Stroke

```typescript
interface Stroke {
  color: Color
  weight: number
  opacity: number
  visible: boolean
  align: 'INSIDE' | 'CENTER' | 'OUTSIDE'
  cap?: 'NONE' | 'ROUND' | 'SQUARE' | 'ARROW_LINES' | 'ARROW_EQUILATERAL'
  join?: 'MITER' | 'BEVEL' | 'ROUND'
  dashPattern?: number[]
}
```
