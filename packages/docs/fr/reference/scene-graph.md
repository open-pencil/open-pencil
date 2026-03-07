# Graphe de scène

## Représentation en mémoire

Les nœuds vivent dans une Map plate `Map<string, Node>` keyed by GUID string. La structure arborescente est maintenue via `parentIndex` references. This gives Recherche O(1) by ID and efficient traversal.

```typescript
interface SceneGraph {
  nodes: Map<string, Node>
  root: string

  getNode(id: string): Node
  getChildren(id: string): Node[]
  getParent(id: string): Node | null
  getPages(): Node[]

  createNode(type: NodeType, parent: string, props: Partial<NodeChange>): Node
  updateNode(id: string, changes: Partial<NodeChange>): void
  deleteNode(id: string): void
  moveNode(id: string, newParent: string, position: string): void
  addPage(name: string): Node
  deletePage(id: string): void
  renamePage(id: string, name: string): void

  findByType(type: NodeType): Node[]
  findByName(pattern: string): Node[]
  hitTest(point: Vector, canvas: string): Node | null
  getNodesInRect(rect: Rect, canvas: string): Node[]
}
```

## Pages

Documents support multiple pages (CANVAS nodes as direct children of the DOCUMENT root). Each page has its own child tree and independent viewport state (panX, panY, zoom, pageColor). The editor tracks `currentPageId` and renders only the active page's children.

## Sections

SECTION nodes are top-level organizational containers (direct children of CANVAS only). They cannot nest inside frames or groups. Creating a section auto-adopts overlapping siblings. Sections display a title pill with luminance-adaptive text color.

## Hover State

The editor state tracks `hoveredNodeId` — the node currently under the cursor. The renderer draws a shape-aware hover outline (following actual geometry for ellipses, rounded rects, vectors) for visual feedback before selection.

## Undo/Redo

The system uses Figma's **inverse command** pattern. Each undo entry contains the forward changes and their automatically-computed inverse:

| Operation | Forward | Inverse |
|-----------|---------|---------|
| Create node | `{guid, phase: CREATED, ...props}` | `{guid, phase: REMOVED}` |
| Delete node | `{guid, phase: REMOVED}` | `{guid, phase: CREATED, ...allProps}` |
| Change prop | `{guid, fill: "#F00"}` | `{guid, fill: "#00F"}` |
| Move node | `{guid, parentIndex: newParent}` | `{guid, parentIndex: oldParent}` |

Before applying any change, affected fields are snapshotted. The snapshot becomes the inverse.

**Batching** — operations like drag-to-move produce hundreds of position changes per second. These are debounced into a single undo entry. `beginBatch`/`commitBatch` wraps multi-step operations.

## Layout Engine (Yoga)

Figma's auto-layout properties map to Yoga flexbox:

| Figma Property | Yoga Equivalent |
|---|---|
| `stackMode: HORIZONTAL` | `flexDirection: row` |
| `stackMode: VERTICAL` | `flexDirection: column` |
| `stackSpacing` | `gap` |
| `stackPadding` | `padding` |
| `stackJustify: MIN/CENTER/MAX/SPACE_BETWEEN` | `justifyContent` |
| `stackCounterAlign` | `alignItems` |
| `stackPrimarySizing: FIXED/HUG/FILL` | width/height + flex-grow |
| `stackChildPrimaryGrow` | `flexGrow` |
| `stackChildAlignSelf` | `alignSelf` |
| `stackPositioning: ABSOLUTE` | `position: absolute` |

## Hit Testing

Given a point in canvas coordinates, the scene graph returns the topmost visible node at that position. The algorithm:

1. Traverse visible nodes in reverse z-order (top to bottom)
2. Transform the test point into each node's local coordinate system
3. Check if the point is within the node's bounds (including rotation)
4. Return the first match

For marquee selection, `getNodesInRect` returns all nodes whose bounds intersect the given rectangle.

## Extended Fill Types

Fills support six types: SOLID, GRADIENT_LINEAR, GRADIENT_RADIAL, GRADIENT_ANGULAR, GRADIENT_DIAMOND, and IMAGE. Gradient fills carry `gradientStops` (color + position pairs) and a `gradientTransform` (2×3 matrix). Image fills reference blob data via `imageHash` with scale modes (FILL, FIT, CROP, TILE).

## Extended Stroke Properties

Strokes support `cap` (NONE, ROUND, SQUARE, ARROW_LINES, ARROW_EQUILATERAL), `join` (MITER, BEVEL, ROUND), and `dashPattern` (array of dash/gap lengths) in addition to the base color, weight, opacity, visible, and align properties.

## Coordinate System

Nodes store position and size relative to their parent. To get absolute (canvas) coordinates, walk up the parent chain applying transforms. The renderer uses this to draw nested frames with correct positioning.

Rotation is stored in degrees and applied as part of the 2×3 transform matrix. Snap guides and hit testing account for rotation when computing visual bounds.
