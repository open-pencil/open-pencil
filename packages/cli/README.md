# @lawha/cli

Headless command line for [Lawha](https://github.com/aliaaldihnayn-lab/design#readme) and `.fig` files: inspect documents and layers, query with XPath, export to PNG, JPG, WEBP, SVG, PDF, PPTX, JSX, HTML, or `.fig`, import HTML/CSS/Tailwind, lint design files, analyze and extract design tokens, and script documents through `eval` with a Figma Plugin API-compatible `figma` global and an `lawha` global for what Lawha adds, such as component behaviours and slots.

```sh
npm install -g @lawha/cli   # or: bun add -g @lawha/cli
lawha --help
lawha eval design.fig -c "return figma.currentPage.children.length"
```

Inspection commands support `--json` for automation. The MCP server ships separately as `@lawha/mcp`.

- CLI reference: https://github.com/aliaaldihnayn-lab/design#readme
- Scripting with the Plugin API: https://github.com/aliaaldihnayn-lab/design#readme
- Source and issues: https://github.com/aliaaldihnayn-lab/design

MIT License.
