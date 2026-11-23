# @open-pencil/collab

How a collaboration room's [Yjs](https://yjs.dev) document maps to and from an OpenPencil `SceneGraph`. The editor keeps its graph in step with a room through this package, and a server can read a room's document into a graph the same way.

- Layers and their fields, encoded per field so concurrent edits to one layer merge (`node-codec.ts`).
- The shared layer tree: each layer's parents, order key, and page, so concurrent moves converge (`shared-tree/`, `tree/`).
- Variables and collections, and the document's data outside its layers: plugin data, comment threads, libraries, color space, and kind (`variables.ts`, `document/sync.ts`).
- Which of the room's edits its stored revisions hold (`saves.ts`).
- Rooms themselves: the messages peers exchange, a connection over any `CollabRoomTransport`, images kept outside the document through a `RoomImageStore`, and `openCollabRoom`, which keeps a room's document in step with an editor (`room/`).

It depends on `@open-pencil/scene-graph`, `yjs`, `y-protocols`, and a few small libraries, with no Vue or app code. What a room needs of an editor is the `RoomEditor` interface: its graph, the events of local edits, the refreshes a peer's edit asks for, the page it shows, and the document's name. Transports, who a peer is, and what else it shares in presence belong to the host: the editor app's Trystero and Cloud relay transports, people, agents, and voice calls build on the room's `awareness` and `connection`.
