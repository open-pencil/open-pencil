---
title: Privacy and Usage Stats
description: What OpenPencil sends over the network, why it sends anonymous usage stats, and how to turn every part of it off.
---

<script setup>
import { describeBuildFields, describePingFields, describeUsageEvents } from '@open-pencil/feedback/contract'

const columns = [
  { key: 'name', label: 'Field', kind: 'code' },
  { key: 'values', label: 'Values', kind: 'description' }
]

function rows(fields) {
  return fields.map((field) => ({
    name: field.name,
    description: field.description,
    values: field.values.length > 0 ? field.values.join(', ') : 'A version number'
  }))
}

const pingRows = rows(describePingFields())
const buildFields = describeBuildFields()
  .map((field) => field.name)
  .join(', ')
const events = describeUsageEvents()
</script>

# Privacy and Usage Stats

- Your designs, file names, layer names, text, prompts, and keys never leave your device unless you share or sync them yourself.
- Official builds send one anonymous ping a day, with no ID. You can turn it off.
- Detailed usage stats are sent only if you say yes when asked, and you can stop at any time.

## Why we collect anything

OpenPencil is built by a small team. We need to know which platforms, file formats, and features people use so we can decide what to build next. We also need to show that OpenPencil is used, because that is what keeps the project funded. A count of active installs and a picture of which features matter answer both questions without knowing anything about you or your work.

## The daily ping

Once a day, an official build sends this to `feedback.openpencil.dev`:

```http
POST https://feedback.openpencil.dev/ping

{ "version": "0.16.0", "platform": "macos", "arch": "arm64", "app": "desktop", "browser": "unknown", "usageStats": "denied" }
```

<SdkDataTable :columns="columns" :rows="pingRows" />

It carries no ID, so pings from the same install cannot be linked. The answer to the usage stats question is the only way we learn how many people decline, since declining means nothing else is ever sent. The app stores only the date of its last ping, so it pings once a day. The server adds one to a counter for that day and build, and keeps nothing else. It does not log addresses, and it rejects a ping that carries any other field.

The ping is on by default. Turn it off in **Settings → Privacy**.

## Usage stats

Usage stats are off until you agree. OpenPencil asks once, in a small prompt that appears after the welcome screen on first launch, or on a later launch if you have not answered, with two equal choices: **No thanks** and **Share stats**. Nothing is selected for you, and you can change your answer later in **Settings → Privacy**.

When you agree, the app creates a random install ID on your device. It is not linked to an account, an email address, or anything else about you. Usage events are sent with it, together with the build fields above (<code>{{ buildFields }}</code>). When you stop sharing, the app deletes the ID; agreeing again creates a new one.

These are all the events the app can send. The service at `feedback.openpencil.dev` checks every event against this list and rejects any event, property, or value that is not on it, so a modified app cannot send anything else through it either.

<template v-for="event in events" :key="event.name">
  <h3><code>{{ event.name }}</code></h3>
  <p>{{ event.description }}</p>
  <SdkDataTable v-if="event.properties.length" :columns="columns" :rows="rows(event.properties)" />
</template>

Accepted events go to [PostHog](https://posthog.com), a product analytics service, on its EU cloud. The request comes from our server, not your device, so PostHog never sees your address. Events create no person profiles and skip location lookups. We keep usage stats for 12 months.

## Turning it all off

- **Settings → Privacy** has a switch for the ping and one for usage stats.
- In the desktop app, starting OpenPencil with `OPENPENCIL_TELEMETRY=0` or `DO_NOT_TRACK=1` in its environment turns off both.
- Only official releases send anything. Development servers, self-built apps, and forks send nothing, because the switch that enables sending is set only when we build a release.

## Cloud waitlist

If you join the OpenPencil Cloud waitlist on this site, we store your email address and the optional note you add. We send one email to confirm the address and write again only when Cloud is ready for you. Addresses that are not confirmed are deleted after seven days, and every email has a link that removes yours.

## Other network requests

OpenPencil is local-first, but some features reach the network. The desktop app checks for updates on its own; everything else below connects only when you use that feature, and only to the service named.

| Feature                 | Where it connects                                                                                                                                                                                       |
| ----------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Update checks (desktop) | GitHub Releases, for the latest version number                                                                                                                                                          |
| AI chat and image tools | The provider you configure, with your own key; the model list comes from models.dev. With **OpenPencil Cloud** as the provider, the AI service your Cloud server names, with a token for your workspace |
| Collaboration rooms     | Other people in the room directly; public brokers introduce peers, and a TURN relay carries traffic when a direct connection is not possible                                                            |
| Cloud storage           | The storage provider you configure                                                                                                                                                                      |
| Fonts                   | Google Fonts, which can supply a font a document uses that is not installed                                                                                                                             |
| Icons                   | The Iconify API, when you search or insert icons                                                                                                                                                        |
| Stock photos            | Unsplash or Pexels, with your own key, when you search them or place one of their photos                                                                                                                |

The app, the feedback service, and this page are open source. The event list lives in [`packages/feedback/src/contract`](https://github.com/open-pencil/open-pencil/tree/master/packages/feedback/src/contract), and the tables above are generated from it.
