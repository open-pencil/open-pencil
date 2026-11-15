# @open-pencil/drawio

The draw.io (diagrams.net) file format: its document model, and a reader and writer for `.drawio` and `.dio` files and the diagrams draw.io embeds in its PNG and SVG exports.

The reader takes plain and compressed pages, keeps cells in draw.io's drawing order with their layers, styles, geometry and `UserObject` attributes, and unpacks everything a file holds within one size limit. The writer saves pages uncompressed, as draw.io does by default. Neither depends on `@open-pencil/scene-graph`; converting diagrams to and from design layers happens in `@open-pencil/core`.
