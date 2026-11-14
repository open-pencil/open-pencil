---
title: Models and Providers
description: Which AI providers the chat works with, what works in the browser and in the desktop app, and what to do when a provider can't be reached.
---

<script setup>
import ModelProviders from '#docs/theme/components/ModelProviders.vue'
</script>

# Models and Providers

The [AI chat](./ai-chat) uses a model you connect: a [coding agent](./coding-agents) you already have, an API key from a provider, your [OpenPencil Cloud](/cloud/ai) account, or your own server. Requests go straight from the app to the provider; no OpenPencil server sits in between.

Add a model from **Settings → Models**, or let guided setup do it.

## Providers

<ModelProviders />

**OpenAI-compatible** fits most other services and local servers, with a switch between the Completions and Responses APIs. **Anthropic-compatible** fits services that speak Anthropic's Messages API. Enter the base URL, the key, and the model ID your server expects.

With **OpenRouter** you can also sign in instead of pasting a key. **ChatGPT** uses your ChatGPT plan instead of an API key, and its replies count toward the plan's limits. See [AI Chat](./ai-chat#supported-providers) for how its sign-in works.

## In the browser and in the desktop app

The desktop app can reach any provider, and keeps keys in your system's credential store. It also offers what the browser can't: coding agents and signing in with ChatGPT.

The web app sends requests from the browser, so the provider has to allow that (CORS). The built-in providers do; for your own server or another service, check before relying on it.

When the web app shows **"Could not reach this endpoint from the browser"**, the request never got an answer the browser would accept. Either the provider doesn't allow browser requests, or it does but leaves the permission off its error responses, so a wrong key or model name looks the same. Try the same settings in the desktop app: if they work there, the provider blocks the browser. [Testing a Model Provider](/development/testing-model-providers) shows how to check a provider yourself.

## Choosing a model

The chat works by calling tools, so a model has to support **tool calling**, and stream it reliably; models differ here even on the same provider. Add **vision** to let the chat look at images and check its own work.

Reasoning models can spend their whole output budget thinking. If a model stops without doing anything, raise its **Max output tokens**, or lower its **Thinking level**.

Each step of a reply sends the conversation and the tool descriptions again, so long replies use many input tokens. **Maximum steps per message** in **Settings → Models → Chat** caps that; see [Step limit](./ai-chat#step-limit).

## Keys and security

In the browser, keys are kept in encrypted browser storage so you don't enter them again; Settings can keep them for the session only instead. The desktop app uses your system's credential store. A key stored in the browser can still be used by scripts running on the page, so prefer scoped keys with spending limits where the provider offers them.
