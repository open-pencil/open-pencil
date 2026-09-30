# @open-pencil/cli

Headless command line for [OpenPencil](https://openpencil.dev) and `.fig` files: inspect documents and layers, query with XPath, export to PNG, JPG, WEBP, SVG, PDF, PPTX, JSX, HTML, or `.fig`, import HTML/CSS/Tailwind, lint design files, analyze and extract design tokens, and script documents with a Figma Plugin API-compatible `figma` global through `eval`.

```sh
npm install -g @open-pencil/cli   # or: bun add -g @open-pencil/cli
openpencil --help
openpencil eval design.fig -c "return figma.currentPage.children.length"
```

Inspection commands support `--json` for automation. The MCP server ships separately as `@open-pencil/mcp`.

- CLI reference: https://openpencil.dev/programmable/cli/inspecting
- Scripting with the Plugin API: https://openpencil.dev/programmable/cli/scripting
- Source and issues: https://github.com/open-pencil/open-pencil

MIT License.
