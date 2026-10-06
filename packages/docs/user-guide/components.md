---
title: Components
description: Creating reusable components, instances, component sets, overrides, and live sync in OpenPencil.
---

# Components

Components are reusable design elements. Edit the main component and all its instances update automatically.

## Browse Components

Open the **Assets** tab in the left panel to browse local components and enabled libraries. Use grid or list view, search by component name, and select a component to see its details. You can insert an asset by clicking it, pressing <kbd>Enter</kbd>, or dragging it onto the canvas.

Local assets are grouped by source page. Published library assets remain available when their revision has been downloaded, including when the remote provider is temporarily offline.

## Creating a Component

Select a frame or group and press <kbd>⌥</kbd><kbd>⌘</kbd><kbd>K</kbd> (<kbd>Ctrl</kbd> + <kbd>Alt</kbd> + <kbd>K</kbd>). The selection becomes a reusable component.

Any other layer, or several layers, is wrapped in a new white component at their bounding box, in the topmost layer's place in the layer list; a single wrapped layer gives the component its name.

Components display a purple label with a diamond icon above them.

## Component Sets and Variants

Select two or more components and press <kbd>⇧</kbd><kbd>⌘</kbd><kbd>K</kbd> (<kbd>Shift</kbd> + <kbd>Ctrl</kbd> + <kbd>K</kbd>) to combine them into a component set — a container with a dashed purple border and 20 px padding around its children, as in Figma. Sets made by scripts with `figma.combineAsVariants()` wrap their components exactly, as Figma's plugin API does.

Each component in a set can define values across multiple variant dimensions, such as `Size=Small`, `State=Hover`, and `Theme=Dark`. OpenPencil supports sparse combinations, so a set does not need every possible combination. The top-left variant is the default and is used as the fallback when an update no longer contains an exact combination.

Use the component properties panel to add, rename, reorder, and remove variant dimensions and values. Duplicate combinations are rejected.

## Component Properties

Components and component sets support reusable text, boolean visibility, instance-swap, and slot properties. Link a property to a descendant field, then select an instance to edit its assigned value without detaching it. Properties and assignments are preserved when saving and reopening `.fig` files.

## Slots

A slot is a frame of a main component whose content each instance can change. Select a frame inside a main component and choose **Create slot** from the context menu or the Slots section, or select other layers to wrap them in a new slot frame. Slot settings set a description, the components it prefers, and how many items it holds; an instance outside those limits shows a warning. In an instance, add, reorder, and remove a slot's items, or reset it to the component's content.

## Behaviours and Preview

A behaviour makes a main component or component set work like a real control, after [Reka UI](https://reka-ui.com)'s primitives: Button, Text field, Textarea, Number field, Toggle, Switch, Checkbox, Radio, Radio group, Toggle group, Slider, Progress, Tabs, Collapsible, or Accordion. Select the component and use **+** in the **Behaviour** section to choose one.

The section lists what the control needs:

- **Values** — the property that holds each value: a variant or boolean property for On, Checked, Pressed, Open, Filled, or Disabled (with the variant values that mean on and off), a text property for a field's text, or a slider's own minimum, maximum, step, and default.
- **Parts** — the slot that draws each part, such as a switch's thumb, a slider's track, range, and thumb, or a tab list. A group's items slot holds instances of its radios, toggles, or collapsibles.
- **States** — a variant property whose values draw default, hover, pressed, focus, and disabled. Values named like those states are matched automatically.

Rows the control requires come first; the rest are under **More options**. When a component has nothing to bind yet, a row offers to create it: a text layer and text property, Off and On variants, or a slot, and **States** offers **Add state variants**, which adds a Default, Hover, Pressed, Focus, and Disabled variant of the component. A lone main component that gets variants this way becomes a component set, and a slot added to a set appears in every variant. Until the control works, a line under its name says what is still needed; clicking it goes there.

Press <kbd>⌥</kbd><kbd>⌘</kbd><kbd>↩</kbd> (<kbd>Ctrl</kbd> + <kbd>Alt</kbd> + <kbd>Enter</kbd>), choose **View → Preview**, or use ▶ next to Share to preview the canvas. Each top-level layer holding controls runs as live Reka UI components over the canvas, drawn by the component's variants: switches flip, sliders drag, tabs and accordions open, and text fields are real inputs with the browser's caret, selection, and paste. Preview never changes the document or its history. **Reset** puts every control back as designed, and <kbd>Esc</kbd> or the pill's close button returns to editing. In split view, each canvas previews on its own.

Behaviours are saved in `.fig` files and published with library components.

## Component Libraries

A component library publishes reusable components as an immutable revision. Each published asset has stable library, asset, and revision identity, so different instances can remain on different revisions until you explicitly update them.

### Publish a Library

1. Create the components and component sets you want to share.
2. Open **Assets**, then select **Manage libraries**.
3. Select **Publish library**.
4. Enter a stable library ID and display name. The library ID is locked after the first publication.
5. Optionally search the change list and enter a revision description.
6. Select the added, modified, renamed, or removed assets to include.
7. Confirm the destination and select **Publish library**.

On later publications, unchecked changes remain pending. Unchanged assets keep their previous published definitions, and removed definitions remain available while documents still reference their historical revision.

### Enable and Insert Library Assets

Open **Assets → Manage libraries** to enable a published library. Its components appear in the Assets panel alongside local components. Insert one by clicking it, using the keyboard, or dragging it onto the canvas.

Published definitions are read-only in consuming documents. Edit the source document and publish another revision to change a definition. Instances linked to those definitions remain editable through their component properties and overrides.

### Review and Accept Updates

Open **Manage libraries → Updates** to discover newer revisions. Discovery does not modify the document. You can review the current and updated instance side by side, navigate between affected instances, and then update:

- The selected instance
- All instances of one asset
- Instances on the current page
- Instances across all pages

OpenPencil preserves compatible text, visibility, and instance-swap assignments. If an exact variant no longer exists, the review identifies the top-left fallback before you accept it. Applying an update creates an undo entry.

### Local, Storage, and Offline Use

Libraries can use the local browser catalog or a configured storage provider. Remote publication uses immutable revision objects and a conditional latest pointer, preventing two publishers from silently overwriting each other.

Downloaded revisions are cached locally. A document can continue rendering and inserting downloaded definitions while offline. Integrity failures are reported instead of being hidden by cached data.

### Saving Consumer Documents

Enabled-library bindings and materialized definitions are saved with `.fig` documents. Reopening a consumer file preserves its linked instances and revision identities, even when its remote library is unavailable.

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
| Preview | <kbd>⌥</kbd><kbd>⌘</kbd><kbd>↩</kbd> | <kbd>Ctrl</kbd> + <kbd>Alt</kbd> + <kbd>Enter</kbd> |

## Tips

- Editing text inside an instance creates an override — the text won't be overwritten when the component changes.
- Use component sets to organize multidimensional variants such as size, state, and theme.
- Publish reusable assets from their source document; published definitions are intentionally read-only in consumer documents.
- Review updates before accepting them when a revision removes an exact variant combination.
- See [Context Menu](./context-menu) for all component-related actions.
