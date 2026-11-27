---
pageClass: guide
title: Component Libraries
description: Publish components, styles, and variables from one file, use them in others, and take their updates.
---

# Component Libraries

A library shares a file's components, styles, and variables with your other files. Each time you publish, it saves a new version. Files that use the library choose when to take it.

## Publish a Library

1. Open the file with the components you want to share.
2. Open **Assets**, then click **Manage libraries** beside the search field.
3. Click **Publish library**.
4. The first time, give the library an ID and a name. The ID can't change later.
5. Tick the changes to publish, and add a description if you like.
6. Click **Publish library**.

<GuideImage name="component-libraries/publish" alt="Publish library with the ID acme-ui, the name Acme UI, and the Button component ticked" />

A library always carries every style and variable collection in the file. Changes you leave unticked wait for the next time.

## Use a Library

1. Open **Assets → Manage libraries** in the file that needs it.
2. Turn the library on in **Browse libraries**.
3. Place its components from **Assets** as you place your own.

A component brings the styles and variables it uses. They can't be edited here: change them in the library's file and publish again. Instances stay editable like any other.

## Update to a New Version

Open **Manage libraries → Updates** to see what changed. Nothing changes in your file until you choose.

1. Compare an instance before and after the update.
2. Update the selected instance, every instance of that component, the instances on this page, or all of them.

Instances keep the changes you made to them, also on layers the library renamed. They lose only changes on layers the library removed. When an instance's variant is gone from the new version, the review says which variant it falls back to. **Undo** takes an update back.

## Where Libraries Live

**Local** libraries stay in this browser or app. **Storage** libraries live in the [S3-compatible bucket](./cloud-storage) you set up, so other people can use them. Switch between them at the top of **Browse libraries**.

Versions you've used are kept on your computer, so their components still show and can be placed while you're offline. A file keeps the library versions it uses when you save it, and opens the same way even when the library can't be reached.
