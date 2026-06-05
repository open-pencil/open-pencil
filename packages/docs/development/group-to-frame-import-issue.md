# Analysis: Why Figma Groups Import as Frames in OpenPencil

We have compared the layers panel structure and raw properties of Figma and OpenPencil, using the test file `/Users/rcoenen/Downloads/KonversioDesigns.fig` as a case study. Here is the technical breakdown of why Figma groups (like `Group 1` and `NO-US-Cloud-Act`) import as frames (`#`) in OpenPencil.

---

## 1. Core Findings & Diagnosis

In Figma's internal file format (the binary Kiwi format), **there is no distinct `GROUP` node type used at rest.** Instead:
1. **Figma represents groups as `FRAME` node changes** (type value `4` in Kiwi schema, matching `type: "FRAME"`).
2. **Figma marks them with the boolean property `resizeToFit = true`** (field tag `117` in the Kiwi schema).
3. The bounding box of the group is computed dynamically based on the bounds of its children, which is why it is marked to "resize to fit".

### The OpenPencil Import Bug
During the import path (both for `.fig` files and clipboard contents), OpenPencil decodes the binary file and converts the properties using `nodeChangeToProps`:

```typescript
export function nodeChangeToProps(
  nc: NodeChange,
  blobs: Uint8Array[]
): Partial<SceneNode> & { nodeType: NodeType | 'DOCUMENT' | 'VARIABLE' } {
  let nodeType = mapNodeType(nc.type)
  if (
    (nodeType === 'FRAME' && isComponentSet(nc)) ||
    getOpenPencilPluginValue(nc, NODE_TYPE_PLUGIN_KEY) === 'COMPONENT_SET'
  ) {
    nodeType = 'COMPONENT_SET'
  }
  // ...
```

1. `mapNodeType(nc.type)` maps `"FRAME"` -> `"FRAME"`.
2. OpenPencil checks if the frame is a `COMPONENT_SET`, but it **never checks `nc.resizeToFit`** to reclassify a `"FRAME"` node as a `"GROUP"`.
3. Consequently, every imported Figma group is added to the scene graph with `type: 'FRAME'`.

### The Visual Proof
This explains why, in the case study document `KonversioDesigns.fig`:
* **In Figma:** `Group 1` (guid `13:19`) and `NO-US-Cloud-Act` (guid `4:158`) display with a **dashed square icon** (Group).
* **In OpenPencil:** Both nodes are imported as `'FRAME'` and display in the layers panel with the **`#` (Frame) icon**, which also disables group-style child scaling when resized.

---

## 2. Export & Serialization Loss

There is a matching gap in the export path. In `export-node.ts` (and `serialize.ts`):

1. OpenPencil serializes `'GROUP'` nodes back into Figma's format as `'FRAME'` nodes:
   ```typescript
   case 'GROUP':
     return 'FRAME'
   ```
2. However, the serialization process **never writes `resizeToFit = true`** back into the output data.
3. As a result, groups round-tripped through OpenPencil are permanently converted into standard frames.

---

## 3. Recommended Resolution

To restore groups to their correct type and behavior during roundtrips, we need to apply changes in two files:

### A. Fix Import (`convert.ts`)
In `nodeChangeToProps()`, reclassify `FRAME` nodes that have `resizeToFit: true` as `GROUP` nodes:

```diff
  let nodeType = mapNodeType(nc.type)
+ if (nodeType === 'FRAME' && nc.resizeToFit === true) {
+   nodeType = 'GROUP'
+ }
  if (
    (nodeType === 'FRAME' && isComponentSet(nc)) ||
    getOpenPencilPluginValue(nc, NODE_TYPE_PLUGIN_KEY) === 'COMPONENT_SET'
  ) {
    nodeType = 'COMPONENT_SET'
  }
```

### B. Fix Export (`export-node.ts`)
In `sceneNodeToKiwiWithContext()`, ensure `resizeToFit: true` is written to the Kiwi payload if the node is a `GROUP`:

```diff
  const nc: KiwiNodeChange = {
    guid,
    parentIndex: {
      guid: parentGuid,
      position: node.source.orderKey ?? context.fractionalPosition(childIndex)
    },
    type: context.mapToFigmaType(node.type),
    name: node.name,
    visible: node.visible,
    opacity: node.opacity,
    phase: 'CREATED',
    size: exportNodeSize(node),
    transform: exportNodeTransform(context, node)
  }
+ if (node.type === 'GROUP') {
+   nc.resizeToFit = true
+ }
```
