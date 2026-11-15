# @open-pencil/mermaid

Mermaid diagrams read into a typed model: flowcharts' nodes with their shapes and labels, edges with their arrowheads and strokes, subgraphs, and styles.

Parsing uses the grammar of a pinned Mermaid release, copied into `src/upstream` with the text preparation Mermaid runs before it by `bun run generate:mermaid-sources`, so it reads exactly what that release reads. The package does not depend on `@open-pencil/scene-graph`; laying diagrams out as design layers happens in `@open-pencil/core`.
