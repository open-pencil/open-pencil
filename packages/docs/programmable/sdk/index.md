---
title: Vue SDK
description: Build Inkly-powered editors with headless Vue composables and primitives.
---

# Vue SDK

`@inkly/vue` exists so Inkly can be more than a standalone design app.

The goal is to make Inkly a toolkit you can embed into other products, internal tools, and workflow-specific editors — not just a single default UI.

The Inkly app is one composition of that toolkit. The SDK is how you build a different one.

It gives you:

- injected editor context
- CanvasKit-backed canvas rendering
- selection, commands, menu, property-panel, and variables composables
- headless structural primitives like `PageListRoot`, `PropertyListRoot`, and `ToolbarRoot`
- built-in i18n primitives for menus, panels, dialogs, and custom locale pickers

## Start here

<SdkCardGroup>
  <SdkCard title="Getting Started" to="/programmable/sdk/getting-started" description="Install the package, create an editor instance, and mount the core primitives." />
  <SdkCard title="Architecture" to="/programmable/sdk/architecture" description="See how composables, primitives, and editor context fit together." />
  <SdkCard title="Guides" to="/programmable/sdk/guides/custom-editor-shell" description="Build custom shells, property panels, and navigation panels." />
  <SdkCard title="API Reference" to="/programmable/sdk/api/" description="Browse components, composables, and advanced public APIs." />
</SdkCardGroup>

## Why the SDK exists

Different products and teams need different editing surfaces.

Sometimes you want a full design editor. Sometimes you want a focused canvas inside another app. Sometimes you want an internal workflow tool, a template editor, or an AI-assisted editing surface built around a narrow use case.

The SDK is the layer that makes those possible.

## Design principles

- **Headless first**: logic and structure, not app styling
- **Composable over wrapper**: use composables when there is no meaningful structural coordination
- **Intentional public API**: stable exports from `packages/vue/src/index.ts`
- **Framework-aware**: Vue integration over `@inkly/core`

## How to think about the package

The SDK has two main layers:

1. **Composables** for editor state and actions
2. **Primitives** for meaningful UI structure

If you only need editor state and actions, start with composables.
If you are building reusable editor UI building blocks, start with primitives.

## API sections

- [Components](/programmable/sdk/api/components/)
- [Composables](/programmable/sdk/api/composables/)
- [Advanced](/programmable/sdk/api/advanced/)
