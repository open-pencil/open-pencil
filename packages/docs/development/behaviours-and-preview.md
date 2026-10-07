---
title: Behaviours and Preview
description: How components become working controls, how agents and scripts author them, and how preview runs them as live Reka UI islands.
---

# Behaviours and Preview

A behaviour makes a main component or component set work as a real control: a Switch, Slider, Tabs, Text field, and so on, after [Reka UI](https://reka-ui.com)'s primitives. It adds no node types. It describes which of the component's existing properties hold the control's values, which of its slots draw the control's parts, and which variants draw its interaction states. Preview then runs the control as the real Reka UI component, and code export can generate the same.

## The model

The model lives in `@open-pencil/scene-graph` (`packages/scene-graph/src/behaviours/`).

- **Kinds and contracts** (`kinds.ts`). `BEHAVIOUR_CONTRACTS` gives each kind its values and parts, keyed by kind, so a kind without a contract does not type-check. Contracts follow Reka UI's anatomy: every Reka subcomponent is a slot of the component, the component itself is the root, and a slot that holds repeated parts names the Reka part of its children, such as the tab list's triggers or a group's items.
- **Storage** (`schema.ts`, `model.ts`). A behaviour is stored as the `behaviour` field of OpenPencil's plugin data on the component or set, with properties and slots bound by id. Its role is `content`, so it travels with library assets and counts towards their update hash. `.fig` export renames the bound ids to the GUIDs it gives the properties.
- **Values**: a boolean is a variant property (with the values that mean on and off) or a boolean property; text is a text property; a number is the behaviour's own range, since Figma has no number property; a choice is which child of a slot is active.
- **States**: a variant property whose values draw rest, hover, pressed, focus, and disabled.
- **Specs** (`spec.ts`). `behaviourFromSpec` and `behaviourToSpec` convert between the stored behaviour and a spec that names properties and slots, which is how every authoring surface except the panel writes it. Errors name what the component has.

## Authoring surfaces

All of them write the same model.

| Surface | Where | Notes |
|---|---|---|
| Behaviour section | `src/components/properties/component-properties/behaviour/`, `useBehaviour` in `packages/vue` | Binds by id; Core's editor actions (`setBehaviour`, `addBehaviourText`, `addBehaviourVariant`, `addBehaviourPart`) create what is missing in one undo step. |
| `openpencil` scripting API | `packages/core/src/openpencil-api/` | The `openpencil` global next to `figma` in every script runner, through `compileScript`. |
| Tools | `packages/core/src/tools/create/behaviours.ts` | `set_behaviour`, `get_behaviour`, `create_slot`, built on the `openpencil` API. |
| Design JSX | `packages/design-jsx/src/behaviours/`, `export/behaviours.ts` | Reka-named elements (`Switch.Root`, `Switch.Thumb`) render and export components with behaviours. |

## Preview islands

Preview is a per-pane mode (`EditorViewState.play`). It runs controls as real components; it never simulates them on the canvas.

1. **Islands.** `playIslandRoots` (Core) picks the top-level layers of the page that hold an instance with a behaviour. The renderer skips them while the pane previews, and `PlayIslands` (`packages/vue/src/canvas/islands/`) mounts one island per root, laid over the canvas at the pane's pan and zoom.
2. **Shadow DOM.** Each island renders into its own shadow root: app CSS does not reach in, island CSS does not leak out, fonts already loaded by the app apply, and the island moves with the canvas in the same frame. Wheel gestures over an island are passed to the canvas.
3. **State to design.** An island keeps each control's state (values, choice, number, typed text, hover, pressed, focus). Core's `resolvePlayState` copies the island's layers into a private graph and shows each instance in its state: the matching variant, boolean properties, and layers a control reveals, such as tab panels. The document is never changed.
4. **Design to DOM.** The private graph is projected to DOM through `@open-pencil/dom-css`, the same projection HTML export uses, so island fidelity and export fidelity improve together.
5. **DOM to Reka.** Each projected layer has a role: a control's root, a part, a group's item, a tab trigger or panel, or a text input. Roles wrap the layer in its Reka UI primitive with `asChild`, so Reka renders through the designed element. Typing, focus, keyboard navigation, and accessibility are the browser's and Reka's.

Controls and DOM keys use layer paths (names below the island root), not node ids: a variant switch rebuilds an instance's layers with new ids, and a stable path keeps the DOM in place, including a focused input.

## Adding a kind or a part

1. Add the kind to `BEHAVIOUR_KINDS` and its contract to `BEHAVIOUR_CONTRACTS` in scene-graph; part ids follow Reka's part names.
2. Map it in preview: its root and parts in `packages/vue/src/canvas/islands/controls/`, with the Reka primitives it uses.
3. Name its elements in design JSX: `REKA_ELEMENTS` in `packages/design-jsx/src/behaviours/index.ts` and the export's root table in `export/behaviours.ts`.
4. Label it in the Behaviour section (`labels.ts`) and translate the strings.
5. Cover the model and spec in scene-graph tests, preview in `tests/e2e/components/behaviours.spec.ts`, and JSX in `packages/core/tests/design-jsx/behaviours.test.ts`.
