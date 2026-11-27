---
pageClass: guide
title: Components
description: Make reusable components, place instances, add variants and properties, and turn components into working controls.
---

# Components

A component is a piece of design you use again and again, such as a button or a card. Its copies are called instances. Change the component, and every instance changes with it.

<GuideLegend>

<GuideImage name="components/overview" alt="A Button component with two variants in a dashed box, and a Publish instance beside it" />

1. A **component set** holds the variants of one component. It has a dashed purple border.
2. Each **variant** is a component of its own. Its name, such as **Variant=Primary**, shows above it.
3. An **instance** is a copy you place in your design. It keeps its own text, here **Publish**.

</GuideLegend>

## Create a Component

1. Select a frame, or the layers you want to reuse.
2. Press <Keys mac="⌥ ⌘ K" other="Ctrl Alt K" />.

A frame or group becomes the component. Other layers are wrapped in a new component around them. Components show their name in purple above them on the canvas.

## Place an Instance

Open **Assets** at the top of the left panel. It lists the components in your file, by page, and in the libraries you turned on.

<GuideLegend>

<GuideImage name="components/assets" alt="The Assets panel with Button and Switch components" />

- Click a component to place it, or drag it onto the canvas.
- Type in the search field to find one by name.
- The buttons beside the search switch between a grid and a list, and open [libraries](./component-libraries).

</GuideLegend>

You can also right-click a component on the canvas and choose **Create instance**, or press <Keys mac="⌘ D" other="Ctrl D" /> on it.

## Change All Instances

Edit the component: its size, colors, text, layout, or the layers inside it. Every instance follows, except where you changed that instance yourself.

To find the component an instance comes from, right-click the instance and choose **Go to main component**. OpenPencil opens its page and selects it.

## Change One Instance

Select an instance and change it like any other layer: edit its text, swap a color, or hide a layer inside it. These changes stay when the component changes, and everything else keeps following the component.

Some things always come from the component: where each layer sits inside the instance, its rotation, and its constraints.

To cut an instance loose from its component, press <Keys mac="⌥ ⌘ B" other="Ctrl Alt B" />. It becomes a plain frame that looks the same.

## Make Variants

Variants are versions of one component, such as a primary and a secondary button, or a switch that's on and off.

1. Select a component.
2. Click **Add variant** at the top of the Design panel. The component becomes a set, with a copy below it.
3. Change the copy, and give it a name in **Variants**.

To combine components you already have, select them and press <Keys mac="⇧ ⌘ K" other="Ctrl Shift K" />.

A variant can have several properties, such as **Size=Small, State=Hover**. The set doesn't need every combination. When an instance asks for one the set doesn't have, it uses the top-left variant.

## Choose a Variant in an Instance

<GuideLegend>

<GuideImage name="components/instance" alt="Component properties for an instance: Label set to Publish and Variant set to Primary" />

Select an instance. **Component properties** at the top of the Design panel lists what you can set: pick a variant, type a label, or turn a layer on and off.

</GuideLegend>

## Add Properties

Properties are the settings an instance offers. A component set's variant properties are there already.

1. Select the component.
2. Click **+** beside **Properties** and choose a kind:
   - **Text** sets a label's words.
   - **Boolean** shows or hides a layer, such as an icon.
   - **Instance swap** replaces a nested instance, such as the icon itself.
   - **Variant** adds another set of variants.
3. Link a layer to it. Select the layer in the component and click **Apply variable/property** next to its setting: in **Typography** for text, in **Appearance** for showing and hiding, or at the top of the panel for a nested instance.

<GuideLegend>

<GuideImage name="components/property" alt="The Label property open, with its name, default value, and the layer it drives" />

Click a property to rename it, change its default, see the layers it drives, or delete it. Drag properties to reorder them.

</GuideLegend>

To show a nested instance's own properties on your component's instances, choose **+ → Nested instances** and tick it.

## Add Slots

A slot is a frame in a component whose content each instance fills in, such as the body of a card or the items of a list.

1. Select a frame inside the component, or the layers to wrap in one.
2. Click **Create slot** in the Design panel, or choose **Object → Create slot**.

Slot settings take a description, the components it prefers, and how many items it holds; an instance outside those limits shows a warning. In an instance, add, reorder, and remove a slot's items, or reset it to the component's content.

## Make a Component Work Like a Control

A behaviour turns a component into a working button, switch, slider, tab, or text field when you preview your design. The controls come from [Reka UI](https://reka-ui.com).

1. Select the component or component set.
2. Click **+** beside **Behaviour** and choose a control.
3. Fill in the rows it shows.

<GuideLegend>

<GuideImage name="components/behaviour" alt="The Behaviour section for a Switch, marked Ready, with Checked, On, Off, Thumb, States, and Transition" />

- The first rows say which property holds the value, such as **Checked** for a switch, and which slot draws each part, such as its **Thumb**.
- **States** is the variant property for how the control looks at rest, under the pointer, pressed, focused, disabled, and invalid. **Add state variants** makes them for you.
- **Transition** eases the control between states. Its duration and easing can follow [timing and easing variables](./variables#easing-and-timing-variables).

</GuideLegend>

**Ready** shows once the control works. Until then, a line under its name says what's missing: click it to go there.

To try your controls, press <Keys mac="⌥ ⌘ ↩" other="Ctrl Alt Enter" /> or click ▶ next to **Share**. Switches flip, sliders drag, tabs open, and text fields take typing. Preview doesn't change your file. **Reset** puts every control back, and <Keys mac="Esc" other="Esc" /> returns to editing.

Behaviours are saved in `.fig` files, and exported Vue, React, and Storybook components keep them, with each transition written as CSS.

## Share Components Between Files

To use the same components in several files, publish them as a [component library](./component-libraries).
