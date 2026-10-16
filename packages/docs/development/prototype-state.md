---
title: Prototype State
description: How Figma's prototype variables, expressions, and conditionals become state in preview and reactive state in generated Vue and React code.
---

# Prototype State

Status: design, not implemented. It extends [Behaviours and Preview](./behaviours-and-preview): the same rule holds that preview and code export read one model, and that generated code is plain Vue or React on Reka UI or Radix, with no OpenPencil runtime.

## Tokens and state

Figma's variables play two roles that look the same in a file.

- **Tokens.** Colours, sizes, and fonts that change only with a mode, such as light and dark. Code export already writes a bound field as `var(--name)` where CSS resolves it as drawn (`DesignTokens`, `packages/dom-css/src/tokens/references.ts`), and a mode as an attribute on the element that sets it (`modeAttribute`, `tokens/stylesheet.ts`), so CSS switches them without script.
- **State.** Values a prototype changes while it runs: a counter, the selected tab, whether a panel is open, a subtotal shown as text.

A variable is state when an interaction targets it, through a Set variable action, and a collection is state when a Set variable mode action targets it. Every other variable stays a token. The split reads an explicit reference in the file; it never guesses from names or values.

## What Figma stores

A layer's interactions are `prototypeInteractions` in the `.fig` schema, today kept raw for round trip (`packages/fig/src/node-change/convert.ts`).

- An interaction is an event (`interactionType`: click, hover, while pressing, key, after delay, and others) and a list of actions.
- An action's `connectionType` says what it does. `SET_VARIABLE` writes `targetVariableData` to `targetVariable`; `SET_VARIABLE_MODE` sets `targetVariableModeID` on a collection; `CONDITIONAL` holds `conditionalActions`, each a `condition` and its actions, the last without a condition as the else branch. Navigation, overlays, URLs, media, and animation are other connection types.
- Values and conditions are `VariableData`: a constant, an alias, or an expression. The functions Figma's interaction editor writes are `ADDITION`, `SUBTRACTION`, `MULTIPLY`, `DIVIDE`, `EQUALS`, `NOT_EQUAL`, the four comparisons, `AND`, `OR`, `NOT`, and `NEGATE`; string `+` is `ADDITION` on strings. Text content bound to a number or boolean is `STRINGIFY` of an alias, which the reader decodes as a plain binding.

The set is closed and small, so an expression compiles to readable code and evaluates without a general interpreter.

## Model

Each step is its own module with its own tests.

1. **Interactions** (`@open-pencil/scene-graph`). Typed triggers and actions read from and written back to `prototypeInteractions`, starting with Set variable, Set variable mode, and Conditional. Actions the model doesn't cover stay raw and keep their place in the list.
2. **Expressions** (`@open-pencil/scene-graph`). A typed expression tree over aliases and constants, an evaluator with Figma's coercions, and `variableText` for the text a value shows. A JavaScript emitter for the same tree lives in `@open-pencil/emit`.
3. **State** (`@open-pencil/scene-graph`). The state variables and collections of a page, their initial values in the page's modes, and the variables their expressions read.

## Preview

An island already keeps each control's state and shows it through `resolvePlayState` in a private copy of the page; the document never changes. Prototype state is one more layer on that copy: the current value of each state variable and the current mode of each state collection, kept per pane.

An event on a layer runs its actions through the evaluator and updates that state. Text, visibility, and every other binding then resolve in the private graph through the binding resolution the canvas uses on a mode or variable change, and modes switch as an explicit mode on the island root. A behaviour's value bound to a state variable, such as a Switch's checked, reads and writes the same state, so a control and a prototype action can drive one another.

## Code export

| Figma                              | Vue                                                                                       | React                                                  |
| ---------------------------------- | ----------------------------------------------------------------------------------------- | ------------------------------------------------------ |
| State variables of a page          | `reactive()` in a composable the page's components share                                  | a store read through `useSyncExternalStore`            |
| Text bound to a state variable     | <code v-pre>{{ variableText(state.subtotal) }}</code>                                     | `{variableText(state.subtotal)}`                       |
| Visibility bound to a boolean      | `v-if="state.open"`                                                                       | `{state.open && …}`                                    |
| A number or colour bound to state  | a custom property set on the page root from state, read by the stylesheet's `var(--name)` | the same through `style`                               |
| A state collection's mode          | the mode attribute bound to state, `:data-theme="state.theme"`                            | the same                                               |
| An interaction                     | a handler on the layer's element for its event                                            | the same                                               |
| Set variable, Conditional          | assignments and `if` / `else` in the handler                                              | the same                                               |
| A behaviour's value bound to state | `v-model` on the Reka component                                                           | `checked` and `onCheckedChange` on the Radix component |

Stylesheets stay as they are: a bound number or colour stays `var(--name)`, and only the custom property on the root becomes reactive. Expressions are emitted as JavaScript through `@open-pencil/emit`, and `variableText` as a small generated helper, so exported text reads as it does in Figma.

## Capabilities

The [vue-pencil](https://github.com/dannote/vue-pencil) design binds values to capabilities, typed values and actions from VueUse such as `useLocalStorage` or `useDark`. They fit here as sources of state: a state variable can persist through `useLocalStorage`, and a state collection's mode can follow `useDark`. A binding picker then lists state variables and capabilities side by side; export imports the capability and the preview runs the same composable.

## Scope of the first version

- One state store per page, as Figma scopes a prototype to its flow.
- Vue export uses `reactive()`, which adds no dependency to the exported code.
- No navigation: frame changes, overlays, and scrolling come with the prototype flows on the [roadmap](./roadmap), and need a router or frame switcher of their own.

## Order

1. The interaction and expression model with `.fig` read and write.
2. State in preview.
3. State in Vue and React code export.
4. Authoring: an interactions section and an expression field with variable chips. Number and boolean variables join the text content picker here.
