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

If you select multiple nodes, they're wrapped in a new component positioned at their bounding box.

Components display a purple label with a diamond icon above them.

## Component Sets and Variants

Select two or more components and press <kbd>⇧</kbd><kbd>⌘</kbd><kbd>K</kbd> (<kbd>Shift</kbd> + <kbd>Ctrl</kbd> + <kbd>K</kbd>) to combine them into a component set — a container with a dashed purple border and 40 px padding around its children.

Each component in a set can define values across multiple variant dimensions, such as `Size=Small`, `State=Hover`, and `Theme=Dark`. OpenPencil supports sparse combinations, so a set does not need every possible combination. The top-left variant is the default and is used as the fallback when an update no longer contains an exact combination.

Use the component properties panel to add, rename, reorder, and remove variant dimensions and values. Duplicate combinations are rejected.

## Component Properties

Components and component sets support reusable text, boolean visibility, and instance-swap properties. Link a property to a descendant field, then select an instance to edit its assigned value without detaching it. Properties and assignments are preserved when saving and reopening `.fig` files.

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

## Tips

- Editing text inside an instance creates an override — the text won't be overwritten when the component changes.
- Use component sets to organize multidimensional variants such as size, state, and theme.
- Publish reusable assets from their source document; published definitions are intentionally read-only in consumer documents.
- Review updates before accepting them when a revision removes an exact variant combination.
- See [Context Menu](./context-menu) for all component-related actions.
