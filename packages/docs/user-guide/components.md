---
title: Components
description: Creating reusable components, instances, component sets, overrides, and live sync in OpenPencil.
---

# Components

Components are reusable design elements. Edit the main component and all its instances update automatically.
## Creating a Component

Select a frame or group and press <kbd>⌥</kbd><kbd>⌘</kbd><kbd>K</kbd> (<kbd>Ctrl</kbd> + <kbd>Alt</kbd> + <kbd>K</kbd>). The selection becomes a reusable component.

If you select multiple nodes, they're wrapped in a new component positioned at their bounding box.

Components display a purple label with a diamond icon above them.

## Component Sets

Select two or more components and press <kbd>⇧</kbd><kbd>⌘</kbd><kbd>K</kbd> (<kbd>Shift</kbd> + <kbd>Ctrl</kbd> + <kbd>K</kbd>) to combine them into a component set — a container with a dashed purple border and 40 px padding around its children. Component sets are useful for grouping variants (e.g., button states).

## Creating Instances

Right-click a component and select **Create instance** from the context menu. The instance appears 40 px to the right of the source component, visually identical.

Instance creation is available only through the context menu — there's no toolbar button.

## Detaching an Instance

Select an instance and press <kbd>⌥</kbd><kbd>⌘</kbd><kbd>B</kbd> (<kbd>Ctrl</kbd> + <kbd>Alt</kbd> + <kbd>B</kbd>) to detach it. The instance becomes a regular frame with no link to the original component. All overrides are baked in.

## Go to Main Component

Right-click an instance and select **Go to main component**. The editor navigates to and selects the main component, switching pages if needed.

## Live Sync

When you edit a component, all its instances update automatically. Synced properties include:

- Width and height
- Fills, strokes, and effects
- Opacity and corner radii
- Layout properties (auto layout settings)
- Clips content setting

Sync triggers automatically after node updates, moves, and resizes within a component.

## Overrides

Instances can override specific properties without breaking the sync link. When a property is overridden on an instance, that property is skipped during sync — other properties continue to update from the main component.

### Overridable Properties

Child-level overrides support: name, text, font size, font weight, font family, plus all visual and layout properties (fills, strokes, effects, opacity, corner radii, size).

### New Children

When you add a child to a component, all existing instances gain a cloned copy automatically. Child order in instances always matches the component.

## Hit Testing

Components and instances are opaque containers — clicking on a child selects the component itself, not the child. **Double-click** to enter the component and select children inside it.

## Visual Treatment

| Element | Appearance |
|---------|------------|
| Component label | Purple with diamond icon, always visible |
| Instance label | Purple with diamond icon, always visible |
| Component set border | Dashed purple outline |

## Keyboard Shortcuts

| Action | Mac | Windows / Linux |
|--------|-----|-----------------|
| Create component | <kbd>⌥</kbd><kbd>⌘</kbd><kbd>K</kbd> | <kbd>Ctrl</kbd> + <kbd>Alt</kbd> + <kbd>K</kbd> |
| Create component set | <kbd>⇧</kbd><kbd>⌘</kbd><kbd>K</kbd> | <kbd>Shift</kbd> + <kbd>Ctrl</kbd> + <kbd>K</kbd> |
| Detach instance | <kbd>⌥</kbd><kbd>⌘</kbd><kbd>B</kbd> | <kbd>Ctrl</kbd> + <kbd>Alt</kbd> + <kbd>B</kbd> |

## Tips

- Editing text inside an instance creates an override — the text won't be overwritten when the component changes.
- Use component sets to organize variants (e.g., Primary/Secondary/Disabled button states).
- Double-click into a component before editing its children — single click selects the component container.
- See [Context Menu](./context-menu) for all component-related actions.
