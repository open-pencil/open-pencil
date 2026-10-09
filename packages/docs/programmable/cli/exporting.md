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

### Tokens in exported code

HTML and Tailwind JSX write variable-bound properties as the design tokens they come from: a fill bound to `Primary` is `background-color: var(--color-primary)`, and in Tailwind `bg-primary`, or `bg-(--name)` for a token outside Tailwind's namespaces. A layer set to another mode gets that mode's attribute, such as `data-theme="dark"`, so the tokens resolve as the canvas draws them.

A value stays literal where CSS would not reproduce it: the layer no longer draws the variable's value, the token is unitless where a length is needed, or the layer sits in a mode that only its own condition, such as a `@media` query, can select. Standalone HTML includes the stylesheet for the tokens it uses; for fragments and JSX, generate it with `openpencil tokens` (below).

## Design Tokens

Write the document's variables as CSS custom properties:

```sh
openpencil tokens design.fig > tokens.css
openpencil tokens design.fig --format tailwind > theme.css
openpencil tokens design.fig --collection Theme --type COLOR
```

Each collection's default mode goes in `:root`. Every other mode overrides the values that differ under its condition: `[data-theme="dark"]` for a Theme collection's Dark mode, or the selector or `@media` query the mode names. Aliases stay `var()` references and are declared again in each mode that changes what they point to, so switching `data-theme` on any element restyles everything built on it.

```css
:root {
  --color-blue-500: #3B82F5;
  --color-primary: var(--color-blue-500);
}

/* Theme: Dark */
[data-theme="dark"] {
  --color-primary: var(--color-blue-300);
}
```

`--format tailwind` puts tokens with a Tailwind v4 namespace (`--color-*`, `--spacing-*`, `--radius-*`, `--text-*`, …) in `@theme`, so `bg-primary` and `rounded-card` work, and adds a `@custom-variant` per mode, so `dark:bg-surface` follows the same condition. Import the file after `@import "tailwindcss";`. Names come from the variable's code syntax when it names a custom property (`--x` or `var(--x)`), otherwise from its name and type: `Blue/500` as a color is `--color-blue-500`.

Tokens that cannot be written, such as boolean variables or a condition that is not a selector or query, are listed on stderr and left out. The command works in file mode and against the running app.

### W3C design tokens

`--format dtcg` writes the variables and styles as [W3C design tokens](https://www.designtokens.org/tr/2025.10/format/) into a folder:

```sh
openpencil tokens design.fig --format dtcg --out tokens
```

Each collection mode is one file, `Theme/Light.tokens.json` and `Theme/Dark.tokens.json`, in the shape Figma imports as a mode: lengths in `px`, times in `s`, booleans as numbers marked `com.figma.type`, and aliases to another collection naming it in `com.figma.aliasData`. Text and effect styles become typography and shadow tokens in `styles.tokens.json`, kept apart because Figma's import refuses composite tokens. `tokens.resolver.json` is a DTCG resolver that switches each collection's modes and layers the rest, for tools such as Style Dictionary. OpenPencil's own fields, such as a token's `rem` unit, CSS name, scopes, or `clamp()` expression, and each mode's condition, ride in `$extensions["dev.openpencil"]`, so the export reads back exactly.

Import token files into a document with the `import_design_tokens` tool, passing each file's path and text:

```sh
openpencil tool call import_design_tokens design.fig --args-file tokens.json --write
```

It reads a file per mode grouped by folder, a resolver with the files it refers to, or a Tokens Studio file with `$themes`. Collections and modes with existing names, and variables and styles by name, are updated; the rest is added, and nothing is deleted. The result lists what was added, updated, and skipped, with the reason for each skip.

## Storybook Export

Generate one CSF3 `.stories.ts` file per component set or component:

```sh
openpencil export design.fig -f storybook                      # React stories in ./design-stories/
openpencil export design.fig -f storybook --framework vue -o src/stories
openpencil export design.fig -f storybook --framework html --page "Components"
openpencil export design.pen -f storybook -o src/stories --watch  # re-export on every save
openpencil export 'src/**/*.pen' -f storybook --beside --watch    # stories next to each design
```

### Designs next to their stories

Keep each component's design file in the component's folder and export with `--beside`: each document's stories, design images, and `.openpencil-stories.json` manifest go into that document's own folder, next to the component's code. A Storybook `stories` glob such as `../src/**/*.stories.ts` in `.storybook/main.ts` then picks them up without further configuration.

Pass several documents, or a quoted glob such as `'src/**/*.pen'` that OpenPencil expands itself (Node.js 22 or later). Several documents need `--beside` or `--output`; `--page` works with one document only. Documents are exported one after another, and when one fails the rest are still exported before the command exits with an error. `--watch` watches every matched document; a document created after the watch started needs another run.

Stories are titled by the document's file name, and then the page when more than one page has components: `pricing.fig` gives `pricing/Plan picker`, so documents exported together keep their stories apart. Each variant of a component set becomes a story, and its variant properties become `select` controls, so switching a control shows the matching variant. A set with a behaviour gets the control's own props instead: a Switch or Checkbox has a `checked` boolean, a Toggle `pressed`, a Collapsible `open`, and `disabled` when the set draws a disabled state; hover, pressed, and focus stay stories of their own. Standalone components named with slashes, such as `Button/Primary` and `Button/Secondary`, are grouped into one `Button` file with a `Variant` control. A combination the design has no variant for throws a named error in Storybook rather than showing a different variant.

Stories render the component as HTML with inline styles, like `-f html`, so they need no OpenPencil runtime; `--framework` (`react`, `vue`, or `html`) only changes the wrapper and the `Meta`/`StoryObj` import from `@storybook/react-vite`, `@storybook/vue3-vite`, or `@storybook/html-vite`. Text uses the document's font families, which Storybook has to load itself. Static stories don't export text, boolean, or instance-swap properties yet.

With `--framework vue` or `--framework react`, a component set or component whose behaviour is a Button, Switch, Checkbox, Toggle, Collapsible, Tabs, Radio group, Toggle group, or Accordion becomes a real component instead: `<Name>.vue` built on Reka UI, or `<Name>.tsx` with a `<Name>.module.css` built on Radix UI's `radix-ui` package. Its variants are compiled into a stylesheet keyed on the states Reka and Radix set (`data-state`, `data-disabled`, hover, and focus), and every other variant property is a prop the component sets as a `data-*` attribute. In Vue its value is a `v-model` such as `checked` or `open`; in React the component takes the Radix root's props, such as `checked`, `defaultChecked`, and `onCheckedChange`. Its text properties are string props, defaulting to the design's words, which the layers bound to them draw, with a text control in its stories.

Tabs take the open tab as `value` (`v-model:value`, or `defaultValue` and `onValueChange` in React), named by each trigger's words as a slug, such as `account` or `password`, and starting on the first; each trigger and its panel are Reka's or Radix's `Tabs` parts around the design's layers, every trigger drawn like the design's other triggers and taking the first trigger's look while its tab is active, and the stories get a `select` control and a story per tab. A Radio group, Toggle group, or Accordion writes two components: the group, which chooses one item the same way, starting on the item the design draws on, and `<Group>Item` from its items' component set, built as the group's item primitive (`RadioGroupItem`, `ToggleGroupItem`, or `AccordionItem` with its trigger in a header) and taking the `value` it stands for. The group uses it once per item in its items slot, with each item's value, named by its label property or else its words, and its text values. A Radio is only generated as a group's item; a Toggle or Collapsible used on its own still becomes its own component.

Inside a generated component, an instance of another component generated in the same export uses that component rather than drawing its layers: `<Switch>` imported from `./Switch.vue` or `./Switch`, set to the variant, text, and `disabled` values the instance shows. A control the design draws on, such as a checked switch, starts on and stays operable: a local `ref` bound with `v-model` in Vue, `defaultChecked` in React. The parent only places it, so the control keeps its own look and state styles. Instances of components not exported, or exported only as static stories, are drawn as before. An icon placed from a set, unless its paths were edited, is Iconify's component, `<Icon icon="lucide:bell">` from `@iconify/vue` or `@iconify/react`, which loads the icon when shown.

Its stories render the component, and a play function clicks the control and checks its state, so the Storybook project needs `reka-ui` or `radix-ui` installed, and `@iconify/vue` or `@iconify/react` when components hold icons.

Stories carry `parameters.design` entries for [`@storybook/addon-designs`](https://github.com/storybookjs/addon-designs):

- **OpenPencil** — when the document path is inside the current directory, an [`openpencil://` link](../index#url-scheme) that opens the document in the desktop app and selects the variant, or its component set when another layer shares the variant's name. The scheme addresses layers by name, so a story whose variant and component names are both shared by other layers gets no link.
- **Design** — a 2× PNG of the variant, written to `<Name>.design/` next to the story and referenced with `new URL(…, import.meta.url)`, so Vite bundles it. Copy the parameter onto the story of your own component to compare the implementation with the design. `--no-design-images` skips rendering; font substitution follows `--font-policy` as in raster export.

`-o` names the output directory. A `.openpencil-stories.json` manifest there records which document, as a path relative to the output directory, and which page generated each story and design image; commit it with the stories. An export replaces the files that a previous export of the same document generated there, including those of components since deleted or renamed; with `--page`, only that page's. It refuses, before changing anything, to overwrite any other file — a hand-written story, another document's, or a stray image. A one-page export whose file names shifted onto another page's stories asks for a full export instead. Without the manifest, existing stories count as someone else's, so remove them before exporting again. `--watch` keeps the command running and re-exports whenever the document is saved, so Storybook's hot reload follows the design; a save that cannot be read is reported and the watch continues. A missing `--page` or a `--font-policy strict` substitution still ends the command.

## Live App Mode

Omit the file to export from the running app:

```sh
openpencil export -f png                       # export the selection in the active document
openpencil export --page "Components" -f png   # export every layer of a page
openpencil export --node 1:23 -f png           # export one layer, on any page
```

`--page` takes a page name and `--page-id` a page ID from `openpencil documents list`; either exports that page without switching the app to it. Add `--document-id` to export from a document other than the active one.

Live app mode supports PNG, JPG, WEBP, SVG, and PDF. PowerPoint, JSX, HTML, Storybook, and `.fig` exports require a file argument. File-mode thumbnail export is not currently supported.
