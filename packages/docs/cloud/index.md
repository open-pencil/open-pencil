---
title: OpenPencil Cloud
description: Keep documents on OpenPencil Cloud or your team's own server, share them, and edit them together.
---

<script setup>
import CloudActions from '../.vitepress/theme/cloud/CloudActions.vue'
</script>

# OpenPencil Cloud

Design together in OpenPencil. Cloud keeps your files with you on every device, so you can share them with a link and edit them together live.

<CloudActions />

## Hosted or Your Own Server

The editor works the same with both:

<SdkCardGroup>
  <SdkCard title="Hosted for you" to="https://cloud.openpencil.dev" description="The OpenPencil team runs the server, with its database, files, and collaboration rooms in the European Union. Paid plans add storage, editors, and AI credits." />
  <SdkCard title="On your own server" to="/cloud/self-hosting/" description="Run the same open-source code. You decide who can sign up, what plans and limits apply, and which terms people accept." />
</SdkCardGroup>

Sign up for the hosted service in the browser, or from **Settings → Cloud** in OpenPencil 0.17 or later. To use your team's server, [connect to it](./connect).

Cloud is optional: documents on your device and in your own [storage bucket](/user-guide/cloud-storage) work the same with or without it.

The hosted service has its own [Terms of Service](./legal/terms), [Privacy Policy](./legal/privacy), and [subprocessors](./legal/subprocessors). They don't cover servers other people run, which have their operator's terms.
