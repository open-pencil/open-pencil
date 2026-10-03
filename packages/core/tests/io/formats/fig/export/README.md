# `export-contract.json`

Reduced from Figma's Save local copy canvas payload for a controlled document containing:

- A local Inter Medium text style at 14 px with 20 px line height.
- A component with a Boolean visibility property bound to its text child.
- A custom-named instance resized to 240×80 with the label hidden.
- A second instance scaled to 75%, producing 150×45 bounds.

The fixture retains eight records and eleven referenced glyph blobs (base64 encoded).
`ids` identifies the source nodes; `expected` records observations from the Figma plugin API.
Blob indexes were remapped to this fixture's blob table. Font digests are JSON byte arrays,
not numeric-key objects. Temporary oracle page/style objects were removed after capture.

The capture demonstrates modern typed `varValue` defaults and `PROP_REF` parameter bindings.
See [the contract tests](./export-contract.test.ts). It is not a complete document compatibility
fixture and does not prove every export claim in the expected data is currently implemented.
