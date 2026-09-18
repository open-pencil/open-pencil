---
title: AI Chat
description: Built-in AI assistant with 90+ tools for creating and modifying designs.
---

# AI Chat

Press <kbd>⌘</kbd><kbd>J</kbd> (<kbd>Ctrl</kbd> + <kbd>J</kbd>) to open the AI assistant. Describe what you want — it creates shapes, sets styles, manages layout, works with components, and analyzes your design.

## Setup

1. Open the AI chat panel (<kbd>⌘</kbd><kbd>J</kbd>)
2. Click the settings icon
3. Add a model and configure its provider, model ID, credentials, and capabilities
4. Save the model and assign it to **Design agent**

You can configure multiple reusable models and separately assign models for design work, reviews, fast tasks, and image input. Models using the same provider connection reuse its stored credential.

The chat composer grows with multiline prompts and can pin the current canvas selection as explicit node context. Assistant messages show provider reasoning in collapsible sections and provide a per-response copy action. Image attachments remain available for visual references when a Vision model is configured. Streaming responses use a hardened Markdown renderer with Shiki-highlighted code blocks; unsafe link protocols and embedded data images are blocked.

## Step limit

In **Settings → AI & agents → Chat**, set **Maximum steps per message** to a whole number from 1 to 1,000. The default is 50. Press Enter or leave the field to save a valid value; invalid drafts do not replace the saved preference. Higher limits allow longer tool-driven tasks but can increase latency and provider cost.

The built-in AI captures this limit when each message starts. Stopping, remaining-step warnings, and the **Continue** action use that same budget. Changing it does not interrupt an ongoing request; the next message or continuation uses the new limit. A step is one model iteration and can include multiple tool calls. ACP and Pi agents manage their own limits.

## Tool access

Open **Settings → Tool access** to choose which tools direct AI model connections can use. Search by name or description, expand read-only or side-effect groups, and toggle individual tools or an entire group. Group switches affect all tools in that group, not only search results. **Restore defaults** restores the compact default tool set; extended tools such as `create_component` can be enabled individually.

Preferences are saved locally and apply to the next message, including in an existing conversation. They do not change an already-running request. Enabling many tools increases the schemas sent to the model.

The **Local MCP** segment has independent settings for clients connected to OpenPencil's MCP server, including ACP and Pi agents. Restart the server and reconnect stdio clients after changing those settings. Remote MCP connections, WebMCP access, and Pi's shell/filesystem permissions remain separate.

Tool toggles control which tools are offered, not which operations scripts may perform. An enabled `eval` or other script-capable tool can perform design operations whose dedicated tools are disabled; these switches are not a sandbox.

## Saved Conversations

Use **Conversation history** to return to a saved chat, start a **New chat**, or rename or delete a conversation. History and attachment previews are stored locally; **All chats** lets you browse transcripts from other documents.

A conversation belonging to another document is read-only until you open that document. A saved agent transcript is not a guarantee that its external agent session can resume: when resumption is unavailable, start a new chat. Local history is not cloud synchronization or a backup.

In the Chat settings beside the model overview, choose whether reasoning is **Collapsed by default**, **Expand while thinking**, or **Expanded by default**. Disclosure animations follow the app's reduced-motion preference. Expanding older reasoning does not force the conversation to scroll to the bottom.

## Supported Providers

| Provider                 | Models                                          | Setup                                                                                                       |
| ------------------------ | ----------------------------------------------- | ----------------------------------------------------------------------------------------------------------- |
| **OpenRouter**           | Claude, GPT, Gemini, DeepSeek, Qwen, and others | API key from [openrouter.ai](https://openrouter.ai)                                                         |
| **Anthropic**            | Claude Sonnet 4.6, Claude Opus 4.6              | API key from [console.anthropic.com](https://console.anthropic.com)                                         |
| **OpenAI**               | GPT-5.3 Codex, GPT-4.1, o3, o4-mini             | API key from [platform.openai.com](https://platform.openai.com)                                             |
| **Google AI**            | Gemini 3.1 Pro, Gemini 3 Flash                  | API key from [aistudio.google.dev](https://aistudio.google.dev)                                             |
| **Z.ai**                 | GLM-5.1, GLM-5, GLM-4.7, GLM-4.5 family         | API key from [docs.z.ai](https://docs.z.ai/devpack/quick-start)                                             |
| **MiniMax**              | MiniMax M3, M2.7, M2.7-highspeed, M2.5, M2.1    | API key from [platform.minimax.io](https://platform.minimax.io/user-center/basic-information/interface-key) |
| **OpenAI-compatible**    | Any endpoint with OpenAI API format             | Custom base URL + key. Supports Completions and Responses API toggle.                                       |
| **Anthropic-compatible** | Any endpoint with Anthropic API format          | Custom base URL + key                                                                                       |

No backend, no subscription — your key talks directly to the provider. Browser requests are subject to each provider's CORS policy, and model deployments vary in how reliably they stream tool calls. See [BYOK provider and model compatibility](./byok-provider-compatibility) for measured results and reproduction steps.

## External MCP connections

Desktop ACP agents can also use trusted remote [Model Context Protocol](https://modelcontextprotocol.io/) servers. In **Settings → MCP**, under MCP connections, add a named Streamable HTTP endpoint, optionally save a bearer token, and enable the connection. OpenPencil stores the token in the configured credential backend rather than ordinary settings and resolves it only when starting the ACP session.

Remote servers must use HTTPS. Loopback HTTP endpoints are accepted for local development. Review and trust a server before enabling it: its tools may read external data or perform actions with the credentials you provide. OpenPencil's built-in design MCP server remains attached automatically and does not need to be added here.

## What It Can Do

The configurable tool catalog covers these categories; the tools offered to a model depend on your Tool access settings:

- **Create** — frames, shapes, text, components, pages. Renders JSX for complex layouts.
- **Style** — fills, strokes, effects, opacity, corner radius, blend modes.
- **Layout** — auto-layout, grid, alignment, spacing, sizing.
- **Components** — create components, instances, component sets. Manage overrides.
- **Variables** — create/edit variables, collections, modes. Bind to fills.
- **Query** — find nodes, XPath selectors, read properties, list pages, fonts, selection.
- **Inspect** — `get_jsx` for JSX roundtrip view, `diff_jsx` for structural diffs, `describe` for semantic role and design issue detection.
- **Analyze** — color palette, typography audit, spacing consistency, cluster detection.
- **Export** — PNG, SVG, JSX with Tailwind classes. Vision-based verification via `export_image`.
- **Vector** — boolean operations, path manipulation.

## Visual Verification

The assistant can verify its work visually. When `export_image` is enabled, it can capture a screenshot after creating or modifying designs and checks the result against the original request. This catches layout issues, missing elements, and color mismatches that text-only responses would miss.

## Example Prompts

- "Create a card with a title, description, and a blue button"
- "Make all buttons on this page use the same border radius"
- "What fonts are used in this file?"
- "Change the background of the selected frame to a gradient from blue to purple"
- "Export the selected frame as SVG"
- "Find all text nodes with font size less than 12"
- "Describe the selected component — what role does it look like?"
- "Show me the JSX for this frame"

## Tips

- Select nodes before asking — the assistant knows what's selected.
- Be specific about colors, sizes, and positions for precise results.
- The assistant can modify multiple nodes in one message.
- Use "undo" in the editor if you don't like the result — AI mutations support full undo.
- All layout is recomputed automatically after each tool execution.
