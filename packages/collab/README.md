# @open-pencil/collab

How a collaboration room's [Yjs](https://yjs.dev) document maps to and from an OpenPencil `SceneGraph`. The editor keeps its graph in step with a room through this package, and a server can read a room's document into a graph the same way.

- Layers and their fields, encoded per field so concurrent edits to one layer merge (`node-codec.ts`).
- The shared layer tree: each layer's parents, order key, and page, so concurrent moves converge (`shared-tree/`, `tree/`).
- Variables and collections, and the document's data outside its layers: plugin data, comment threads, libraries, color space, and kind (`variables.ts`, `document/sync.ts`).
- Which of the room's edits its stored revisions hold (`saves.ts`).

It depends on `@open-pencil/scene-graph`, `yjs`, `es-toolkit`, and `valibot`, with no Vue or app code. What a room needs of an editor is the `CollabEditor` interface: its graph, the events of local edits, and the refreshes a peer's edit asks for. Transports, presence, and the room's image storage belong to the app.
