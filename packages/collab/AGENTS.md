# Collab

How a room's Yjs document maps to and from a SceneGraph. The app's rooms, transports, presence, and voice live in `src/app/collab` (`src/AGENTS.md`); this package holds only the document mapping, so a server can read a room the same way the editor does.

- The package depends on `@open-pencil/scene-graph`, `yjs`, `es-toolkit`, and `valibot`, never Vue or app code, and reaches an editor only through the `CollabEditor` interface; a graph with no events and nothing to redraw is a complete editor (`packages/collab/tests/graph-sync.test.ts`).
- A shared document records each layer's parent history, order key and page, never `parentId` or `childIds`, and only Share or a room's conversion sets its root in `meta`; local edits are written by `writeLocalPlacement` and remote changes applied by `applySharedTree` in `packages/collab/src/shared-tree/sync.ts`, which resolve the tree with `LayerTree` from `packages/collab/src/tree/` (`tests/app/collab/random-edits.test.ts`).
- What a document holds outside its layers, its document node's plugin data, comment threads, libraries and color space, travels in the room's own maps through `bindDocumentSync` (`packages/collab/src/document/sync.ts`), entry by entry and thread by thread, never on the root layer, so people changing it at once all keep their change (`tests/app/collab/document/sync.test.ts`).
- Changing how a shared document records data bumps `TREE_FORMAT` and `COLLAB_APP_ID` together, so mismatched builds never meet; rooms saved by an earlier format are not converted (`packages/collab/src/shared-tree/fields.ts`).
