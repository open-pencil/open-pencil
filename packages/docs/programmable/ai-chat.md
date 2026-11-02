---
title: AI Chat
description: Built-in AI assistant with 90+ tools for creating and modifying designs.
---

# AI Chat

Press <kbd>⌘</kbd><kbd>J</kbd> (<kbd>Ctrl</kbd> + <kbd>J</kbd>) to open the AI assistant. Describe what you want — it creates shapes, sets styles, manages layout, works with components, and analyzes your design.

## Setup

The first time you open OpenPencil, guided setup asks what AI should help with and what you already use: a [coding agent](./coding-agents) such as Claude Code, Codex, Gemini CLI, or Pi in the desktop app, an API account, or a local or company server. It connects that access and assigns it to the **Design agent** and **Vision** roles, keeping anything you configured by hand. With OpenRouter you can sign in instead of pasting an API key. Skip it to start designing, and run it again from **Settings → Models → Run guided setup**. To configure models by hand:

1. Open the AI chat panel (<kbd>⌘</kbd><kbd>J</kbd>)
2. Click the settings icon
3. Add a model and configure its provider, model ID, credentials, and capabilities
4. Save the model and assign it to **Design agent**

You can configure multiple reusable models and separately assign models for design work, reviews, fast tasks, and image input. Models using the same provider connection reuse its stored credential.

The chat composer grows with multiline prompts. Type `@` to mention a layer, page, or skill, or use the selection button to mention the selected layers, and `/` at the start of a message to run a skill, or one of an ACP agent's commands. Mentions show as chips, in replies too, where the assistant names the layers it touched; click one to show the layer on the canvas. Assistant messages show provider reasoning in collapsible sections and provide a per-response copy action. Image attachments remain available for visual references when a Vision model is configured. Streaming responses use a hardened Markdown renderer with Shiki-highlighted code blocks; unsafe link protocols and embedded data images are blocked.

## Step limit

In **Settings → Models → Chat**, set **Maximum steps per message** to a whole number from 1 to 1,000. The default is 50. Press Enter or leave the field to save a valid value; invalid drafts do not replace the saved preference. Higher limits allow longer tool-driven tasks but can increase latency and provider cost.

The built-in AI captures this limit when each message starts. Stopping, remaining-step warnings, and the **Continue** action use that same budget. Changing it does not interrupt an ongoing request; the next message or continuation uses the new limit. A step is one model iteration and can include multiple tool calls. ACP and Pi agents manage their own limits.

## Tool access

Open **Settings → Tool access** to choose which tools direct AI model connections can use. Search by name or description, expand read-only or side-effect groups, and toggle individual tools or an entire group. Group switches affect all tools in that group, not only search results. **Restore defaults** restores the default tool set: the core editing and inspection tools, the library tools (`get_components`, `list_libraries`, `insert_library_component`), comments, variables, `lint` and `lint_fix`, `export_image`, `list_pages`, and `create_page`. Extended tools such as `create_component` can be enabled individually.

Preferences are saved locally and apply to the next message, including in an existing conversation. They do not change an already-running request. Enabling many tools increases the schemas sent to the model.

The **Local MCP** segment has independent settings for clients connected to OpenPencil's MCP server, including ACP and Pi agents. Restart the server and reconnect stdio clients after changing those settings. Remote MCP connections, WebMCP access, and Pi's shell/filesystem permissions remain separate.

Tool toggles control which tools are offered, not which operations scripts may perform. An enabled `eval` or other script-capable tool can perform design operations whose dedicated tools are disabled; these switches are not a sandbox.

## Skills

Skills are folders with a `SKILL.md` in the [Agent Skills](https://agentskills.io/specification) format: instructions for a kind of work, with optional reference files. The built-in AI sees each enabled skill's name and description and loads its instructions when a request matches. It can read the skill's files, but scripts in a skill do not run.

Open **Settings → Skills** to see where skills come from:

- **Uploaded**: upload a ZIP of a skill's folder or a single `SKILL.md`. Uploads stay in OpenPencil and work in the browser too.
- **Next to this document** (desktop): `.agents/skills` and `.claude/skills` folders from the open document's folder up to its repository. They stay off until you choose **Trust folder**, because a skill gives the AI instructions it follows.
- **Shared agent skills** and **Claude Code skills** (desktop): `~/.agents/skills` and `~/.claude/skills`, where other coding agents install skills. Most of those are coding workflows, so these folders start off; the review step of the AI setup lists their skills for you to pick the ones that help with design.

Uploads are on as soon as you add them, and any folder or skill can be switched on or off. The page lists them as Tool access lists tools: each source is a group with its own switch, and each skill has a switch beside it. Open a skill to read its instructions, see its files, or check warnings about how it departs from the specification. When two skills share a name, the first in that order is used.

To run a skill yourself, type `/` at the start of a message and pick it, which starts the message with `/skill:name`. Pi gets the enabled skills as its own. ACP agents such as Claude Code and Codex load their own skills.

## Saved Conversations

Use **Conversation history** to return to a saved chat, start a **New chat**, or rename or delete a conversation. History and attachment previews are stored locally; **All chats** lets you browse transcripts from other documents.

A conversation belonging to another document is read-only until you open that document. A saved agent transcript is not a guarantee that its external agent session can resume: when resumption is unavailable, start a new chat. Local history is not cloud synchronization or a backup.

In the Chat settings beside the model overview, choose whether reasoning is **Collapsed by default**, **Expand while thinking**, or **Expanded by default**. Disclosure animations follow the app's reduced-motion preference. Expanding older reasoning does not force the conversation to scroll to the bottom.

## Supported Providers

| Provider                 | Models                                                                 | Setup                                                                                                       |
| ------------------------ | ---------------------------------------------------------------------- | ----------------------------------------------------------------------------------------------------------- |
| **OpenRouter**           | Claude, GPT, Gemini, DeepSeek, Qwen, and others                        | API key from [openrouter.ai](https://openrouter.ai)                                                         |
| **Anthropic**            | Claude Sonnet 5.5, Claude Opus 5.5, Claude Fable 5.1, Claude Haiku 5.5 | API key from [console.anthropic.com](https://console.anthropic.com)                                         |
| **OpenAI**               | GPT-6.1 Sol, GPT-6 Astra, GPT-6 Luna                                   | API key from [platform.openai.com](https://platform.openai.com)                                             |
| **ChatGPT**              | The models your ChatGPT plan offers in Codex, listed live              | Desktop app: **Sign in with ChatGPT**. Replies count toward the plan's usage limits.                        |
| **Google AI**            | Gemini 3.8 Flash, Gemini 4 Argon                                       | API key from [aistudio.google.dev](https://aistudio.google.dev)                                             |
| **DeepSeek**             | DeepSeek Flash, DeepSeek V4 Pro                                        | API key from [platform.deepseek.com](https://platform.deepseek.com/api_keys)                                |
| **Z.ai**                 | GLM-5.3, GLM-5.3-Flash, GLM-5.3-FlashX, GLM-5V-Turbo                   | API key from [docs.z.ai](https://docs.z.ai/devpack/quick-start)                                             |
| **MiniMax**              | MiniMax-M3.1-Flash, MiniMax-M3                                         | API key from [platform.minimax.io](https://platform.minimax.io/user-center/basic-information/interface-key) |
| **OpenAI-compatible**    | Any endpoint with OpenAI API format                                    | Custom base URL + key. Supports Completions and Responses API toggle.                                       |
| **Anthropic-compatible** | Any endpoint with Anthropic API format                                 | Custom base URL + key                                                                                       |

No backend — your key or sign-in talks directly to the provider. Browser requests are subject to each provider's CORS policy, and model deployments vary in how reliably they stream tool calls. See [BYOK provider and model compatibility](./byok-provider-compatibility) for measured results and reproduction steps.

**ChatGPT** uses your ChatGPT plan instead of an API key, through the same backend and sign-in as OpenAI's Codex CLI. Signing in opens the browser and returns to the desktop app on `localhost:1455`, the only address OpenAI accepts for it, so close a running `codex login` first. The sign-in is stored like a key and refreshes itself; the model list comes from your account. The browser app does not offer it.

## External MCP connections

Desktop ACP agents can also use trusted remote [Model Context Protocol](https://modelcontextprotocol.io/) servers. In **Settings → MCP**, under MCP connections, add a named Streamable HTTP endpoint, optionally save a bearer token, and enable the connection. OpenPencil stores the token in the configured credential backend rather than ordinary settings and resolves it only when starting the ACP session.

Remote servers must use HTTPS. Loopback HTTP endpoints are accepted for local development. Review and trust a server before enabling it: its tools may read external data or perform actions with the credentials you provide. OpenPencil's built-in design MCP server remains attached automatically and does not need to be added here.

## What It Can Do

The configurable tool catalog covers these categories; the tools offered to a model depend on your Tool access settings:

- **Create** — frames, shapes, text, components, pages. Renders JSX for complex layouts.
- **Style** — fills, strokes, effects, opacity, corner radius, blend modes.
- **Layout** — auto-layout, grid, alignment, spacing, sizing.
- **Components** — create components, instances, component sets, and slots. Manage overrides. Give components Reka UI behaviours so they work in preview.
- **Variables** — create/edit variables, collections, modes. Bind to fills.
- **Query** — find nodes, XPath selectors, read properties, list pages, fonts, selection.
- **Inspect** — `get_jsx` for JSX roundtrip view, `diff_create` and `diff_jsx` for structural diffs, `diff_visual` for pixel diffs, `describe` for semantic role and design issue detection.
- **Analyze** — color palette, typography audit, spacing consistency, cluster detection.
- **Export** — PNG, SVG, JSX with Tailwind classes. Vision-based verification via `export_image`.
- **Vector** — boolean operations, path manipulation.

## Visual Verification

The assistant can verify its work visually. With `export_image`, on by default, it can capture a screenshot after creating or modifying designs and checks the result against the original request. This catches layout issues, missing elements, and color mismatches that text-only responses would miss. `diff_visual`, enabled by default, compares an edited node with a reference copy and returns the changed pixels and region, so the assistant can confirm an edit stayed within its target.

## Messages while the assistant works

You can keep typing while a reply runs. **Enter** sends the message as soon as the current step's tool calls finish, so the built-in AI can change course without being stopped; **Alt+Enter** waits until it has finished all work. Waiting messages show dimmed below the reply, with a button to remove each. **Escape** stops the reply and sends what is waiting at once, and **Up** on the first line takes waiting messages back to edit. ACP agents and Pi take a waiting message once their turn ends.

## Stopping a reply

**Stop** ends a reply at once. A tool call already running finishes, and its edit counts as part of the reply; calls still waiting for their turn change nothing. The reply is marked _Stopped_, its reasoning and any unfinished calls stop showing as running, and your next message tells the assistant whether those calls changed the document.

## Undoing the assistant's edits

Each tool call that changes the document is one step in Edit → Undo. Undoing it with <kbd>⌘</kbd><kbd>Z</kbd> marks the call _Undone_ in the chat. A reply with only some edits undone says how many; one with all of them undone is dimmed and marked _Changes reverted_. Redo removes the marks. The marks are saved with the conversation.

**Revert changes** on a reply undoes its edits while nothing has been edited since, and **Restore changes** brings undone edits back while Redo still can. **Regenerate** and editing your last message undo the replaced reply's edits first when they can.

Your next message tells the assistant which of its edits you undid or redid, so it does not build on edits that are gone. If you undo the assistant's edits while it is still working, it hears about it with its next tool call.

## Following the assistant

With **Follow agents** on, the crosshair button at the top of the AI panel, your view follows the assistant while it works, including to another page when it edits layers there. Following ends when the reply finishes, is stopped, or fails. Clicking, scrolling, zooming, switching pages, or Escape stops following yourself.

## Notifications

When an agent asks for permission and you have not answered for a few seconds, OpenPencil sends a system notification, so you can work in another app while it runs. **Settings → Notifications** also turns on notifications when a reply finishes or fails. They are sent only while OpenPencil is in the background or shows another document, and clicking one opens that document's chat. In the browser, click **Allow notifications** there first; the desktop app follows your system's notification settings.

## Example Prompts

- "Create a card with a title, description, and a blue button"
- "Make all buttons on this page use the same border radius"
- "What fonts are used in this file?"
- "Change the background of the selected frame to a gradient from blue to purple"
- "Export the selected frame as SVG"
- "Find all text nodes with font size less than 12"
- "Describe the selected component — what role does it look like?"
- "Show me the JSX for this frame"
- "Make this component a switch that I can try in preview"

## Tips

- Select nodes before asking — the assistant knows what's selected.
- Be specific about colors, sizes, and positions for precise results.
- The assistant can modify multiple nodes in one message.
- You can browse other pages while a reply runs: the assistant keeps working on the page where the message started, and its previews show when you return. While you're away, the chat says which page it is working on, with **Go to page** to return.
- Undo anything you don't like with Edit → Undo or **Revert changes**; the chat and the assistant both see it.
- All layout is recomputed automatically after each tool execution.
