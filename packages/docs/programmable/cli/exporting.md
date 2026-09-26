---
title: Exporting
description: Export document content to images, PDF, PowerPoint, `.fig`, JSX, HTML, or Storybook stories, with font-substitution policies for raster and PDF output.
---

# Exporting

Export designs from the terminal — raster images, vectors, PDF, editable PowerPoint, `.fig` subsets, JSX code, HTML, or Storybook stories.

## Image Export

```sh
openpencil export design.fig                           # PNG (default)
openpencil export design.fig -f jpg -s 2 -q 90        # JPG at 2×, quality 90
openpencil export design.fig -f webp -s 3             # WEBP at 3×
openpencil export design.fig -f svg                   # SVG vector
openpencil export design.fig -f pdf                   # PDF
openpencil export design.fig -f pptx                  # editable PowerPoint
openpencil export design.fig -f fig --page "Page 1"   # export one page as .fig
openpencil export design.fig -f fig --node 1:23        # export one node as .fig
openpencil export design.fig -f html --css tailwind    # export an HTML fragment with Tailwind classes
```

Options:

- `-f` — format: `png`, `jpg`, `webp`, `svg`, `pdf`, `pptx`, `jsx`, `html`, `fig`, `storybook`
- `-s` — export scale (default: `1`)
- `-q` — quality: `0`–`100` (JPG/WEBP only)
- `-o` — output path
- `--page` — page name
- `--node` — specific node ID

## Font Substitution Policy

For file-backed PNG, JPG, WEBP, and PDF exports, choose how missing or substituted fonts are handled:

```sh
openpencil export design.fig -f pdf --font-policy strict
openpencil export design.fig -f png --font-policy warn
openpencil export design.fig -f webp --font-policy allow
```

- `warn` (default) — report substitutions and continue exporting.
- `strict` — stop with a nonzero exit status if font preparation cannot faithfully resolve the requested faces.
- `allow` — export without the additional font-fidelity check.

Run [`openpencil fonts`](./inspecting#font-diagnostics) first to inspect affected faces. Export preparation may use configured font providers, so its result can differ from the offline file diagnostic.

This policy does not apply to exports from the running app, or to SVG, PowerPoint, JSX, HTML, and `.fig` output. It checks font resolution, not complete visual equivalence with Figma.

## JSX Export

Export as JSX with Tailwind utility classes:

```sh
openpencil export design.fig -f tailwind-jsx    # or: -f jsx --style tailwind
```

Output:

```html
<div className="flex flex-col gap-4 p-6 bg-white rounded-xl">
  <p className="text-2xl font-bold text-[#1D1B20]">Card Title</p>
  <p className="text-sm text-[#49454F]">Description text</p>
</div>
```

Also supports `--style openpencil` for the native JSX format (see [JSX Renderer](../jsx-renderer)).

## HTML Export

Export as an HTML fragment with inline styles by default, or Tailwind utility classes:

```sh
openpencil export design.fig -f html
openpencil export design.fig -f html --css tailwind
```

Use `--html standalone` for a browser-openable HTML document with reset styles and a page wrapper. Standalone HTML is intended as a useful visual/code handoff, not a pixel-perfect renderer replacement:

```sh
openpencil export design.fig -f html --html standalone --css inline
openpencil export design.fig -f html --html standalone --css tailwind
openpencil export design.fig -f html --html standalone --css tailwind --assets external
```

Standalone Tailwind output is compiled during export; it does not depend on the Tailwind browser runtime. Use `--assets external` to write CSS and extracted image assets next to the HTML file. Use `--fonts assets` with external assets to resolve detected SceneGraph text fonts through OpenPencil's configured web-font providers and emit local `@font-face` files.

HTML export is available in file mode.

## Storybook Export

Generate one CSF3 `.stories.ts` file per component set or component:

```sh
openpencil export design.fig -f storybook                      # React stories in ./design-stories/
openpencil export design.fig -f storybook --framework vue -o src/stories
openpencil export design.fig -f storybook --framework html --page "Components"
openpencil export design.pen -f storybook -o src/stories --watch  # re-export on every save
```

Each variant of a component set becomes a story, and its variant properties become `select` controls, so switching a control shows the matching variant. Standalone components named with slashes, such as `Button/Primary` and `Button/Secondary`, are grouped into one `Button` file with a `Variant` control. A combination the design has no variant for throws a named error in Storybook rather than showing a different variant.

Stories render the component as HTML with inline styles, like `-f html`, so they need no OpenPencil runtime; `--framework` (`react`, `vue`, or `html`) only changes the wrapper and the `Meta`/`StoryObj` import from `@storybook/react-vite`, `@storybook/vue3-vite`, or `@storybook/html-vite`. Text uses the document's font families, which Storybook has to load itself. Text, boolean, and instance-swap properties are not exported yet.

Stories carry `parameters.design` entries for [`@storybook/addon-designs`](https://github.com/storybookjs/addon-designs):

- **OpenPencil** — when the document path is inside the current directory, an [`openpencil://` link](../index#url-scheme) that opens the document in the desktop app and selects the variant, or its component set when another layer shares the variant's name. The scheme addresses layers by name, so a story whose variant and component names are both shared by other layers gets no link.
- **Design** — a 2× PNG of the variant, written to `<Name>.design/` next to the story and referenced with `new URL(…, import.meta.url)`, so Vite bundles it. Copy the parameter onto the story of your own component to compare the implementation with the design. `--no-design-images` skips rendering; font substitution follows `--font-policy` as in raster export.

`-o` names the output directory. A `.openpencil-stories.json` manifest there records which document, as a path relative to the output directory, and which page generated each story and design image; commit it with the stories. An export replaces the files that a previous export of the same document generated there, including those of components since deleted or renamed; with `--page`, only that page's. It refuses, before changing anything, to overwrite any other file — a hand-written story, another document's, or a stray image. A one-page export whose file names shifted onto another page's stories asks for a full export instead. Without the manifest, existing stories count as someone else's, so remove them before exporting again. `--watch` keeps the command running and re-exports whenever the document is saved, so Storybook's hot reload follows the design; a save that cannot be read is reported and the watch continues. A missing `--page` or a `--font-policy strict` substitution still ends the command.

## Live App Mode

Omit the file to export from the running app:

```sh
openpencil export -f png    # export from the current document
```

Live app mode supports PNG, JPG, WEBP, SVG, and PDF. PowerPoint, JSX, HTML, Storybook, and `.fig` exports require a file argument. File-mode thumbnail export is not currently supported.
