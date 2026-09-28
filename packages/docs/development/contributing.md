# Contributing

The root [`CONTRIBUTING.md`](https://github.com/open-pencil/open-pencil/blob/master/CONTRIBUTING.md) is the source of truth for setup, pull-request requirements, validation, and commit expectations. The root [`AGENTS.md`](https://github.com/open-pencil/open-pencil/blob/master/AGENTS.md) holds the repository map and cross-cutting conventions, and links the `AGENTS.md` guide inside each package or app domain. Read the root file and every guide on the path to the folder you change; coding agents pick them up the same way.

See [Architecture](/development/architecture) for the system overview and [Testing](/development/testing) for test ownership, fixtures, and commands. Use the root `AGENTS.md` map when exact package ownership or paths matter; do not infer ownership from an older copied tree.

## Quick start

```sh
bun install
bun run dev:portless # Editor at https://open-pencil.localhost
bun run docs:dev     # Docs at localhost:5173
```

The complete gate before a pull request is `bun run check`, `bun run format`, `bun run test:unit`, and `bun run test`. Rendering and other pixel-affecting changes require targeted visual coverage.

## SDK documentation

VitePress is the canonical public documentation, while Storybook is the internal component-state workshop. Shared Vue demos live beside their SDK primitives and are embedded in both surfaces. The docs Tailwind entry scans these demos, so examples use the same utility-first styling in both environments.

Component API tables are extracted from Vue source and JSDoc with `vue-component-meta`. Keep descriptions next to public props, events, and slots instead of duplicating signatures in Markdown. VitePress processes SDK examples with Twoslash so imports and types stay aligned with the public package API.
