---
pageClass: guide
title: AI Chat
description: Ask the AI to make and change designs, undo what it did, get reviews, and teach it with skills.
---

# AI Chat

Describe what you want, and the AI makes it on the canvas: a screen, a component, a change to every button on the page. Press <Keys mac="⌘ J" other="Ctrl J" /> to open the chat, or click the **AI** tab next to **Design**.

## Set Up the AI

The first time, guided setup asks what you'd like the AI to help with and what you already use:

- a [coding agent](./coding-agents) you have, such as Claude Code or Codex, in the desktop app;
- an account with an AI provider, such as OpenRouter, Anthropic, OpenAI, or Google, or your ChatGPT plan;
- a model running on your computer or your company's server;
- your [OpenPencil Cloud](/cloud/ai) account.

[Models and Providers](./models-and-providers) lists what each one needs. To run setup again, open **Settings → Models → Run guided setup**.

The AI uses a model for each kind of work, which you can change in the model menu under the message field, under **Manage models and roles…**:

| Role | Does |
| ---- | ---- |
| **Design agent** | The chat itself. |
| **Vision** | Reads the images you attach. |
| **Review** | Writes [design reviews](#ask-for-a-review). Uses the Design agent unless you choose another. |
| **Fast tasks** | Names conversations, and, when it's an API model, writes summaries of long ones; otherwise the Design agent writes them. Without it, a conversation takes its first message as its name. |

## Ask for a Design

Type what you want and press <Keys mac="Enter" other="Enter" />. The AI sees which layers are selected, so select what you mean before asking to change it.

<GuideImage name="ai-chat/reply" alt="The AI chat beside the canvas: a request for a trip card, the edit the AI made, its answer, and the new card on the canvas" />

- Type **@** to name a layer, a page, or a skill. Named layers show as chips; click one to find the layer on the canvas. The pointer button names the selected layers.
- Attach images, such as a sketch or a site you like, with the image button. This needs a Vision model.
- Each edit the AI makes shows in its reply. Click one to see what it did.

Some things to try:

- "Make a card with a title, a description, and a blue button."
- "Make all buttons on this page use the same corner radius."
- "Turn this frame's background into a gradient from blue to purple."
- "Make this component a switch I can try in preview."

With a model that reads images, the AI checks its work by looking at a picture of what it made, so it can fix what it got wrong.

## While the AI Works

- Keep working: the AI stays on the page where the message started. The chat says where it's working, with **Go to page** to get back.
- To watch it, turn on **Follow agents**, the target button at the top of the chat. Your view follows the AI, also to another page. Clicking, scrolling, or <Keys mac="Esc" other="Esc" /> stops following.
- Type another message and press <Keys mac="Enter" other="Enter" /> to send it once the current step is done, so the AI can change course. <Keys mac="⌥ Enter" other="Alt Enter" /> waits until it's done with everything. Waiting messages show dimmed below the reply.
- **Stop** ends the reply. An edit already being made finishes; the next message tells the AI what changed.

**Maximum steps per message**, under **Chat** in **Settings → Models**, limits how long one reply of the built-in AI can work, 50 steps unless you change it. Coding agents set their own limits. When a reply reaches it, **Continue** goes on.

## Undo What the AI Did

Each edit the AI makes is one step of <Keys mac="⌘ Z" other="Ctrl Z" />, and the chat marks undone edits.

- **Revert changes** under a reply undoes all of its edits, and **Restore changes** brings them back.
- **Revert and regenerate** undoes them and asks again.

Your next message tells the AI what you undid, so it doesn't build on edits that are gone.

## Ask for a Review

Type **/review** to have the Review model look at the selection, or at the page when nothing is selected, as an art director would: alignment, spacing, contrast, hierarchy, and anything that looks broken.

- Add what to look at, such as `/review typography`.
- Attach images to compare against, such as a screenshot of a site you admire. This needs a model that reads images.
- Under an edit the AI made, **Review this change** asks whether it made the design better.

The review shows as a card, and each finding links to its layer. **Fix these** sends the findings to the AI as your message.

## Teach the AI With Skills

A skill is a set of instructions for a kind of work, such as your team's brand rules, in the [Agent Skills](https://agentskills.io/specification) format: a folder with a `SKILL.md` and any files it refers to. The AI reads a skill when a request needs it. To use one yourself, type **/** and pick it.

Add skills in **Settings → Skills**:

- **Upload** a ZIP of a skill's folder, or a single `SKILL.md`.
- In the desktop app, skills in `.agents/skills` and `.claude/skills` folders next to the open file are found too. They stay off until you choose **Trust folder**, since a skill gives the AI instructions.
- Skills other coding agents installed, in `~/.agents/skills` and `~/.claude/skills`, are listed off. Turn on the ones that help with design.

Coding agents such as Claude Code load their own skills.

## Long Conversations

The AI reads only so much of a conversation at once. The meter at the top of the chat shows how full that is; click it for details.

When the conversation is nearly full, the AI compacts it: it writes a summary that stands in for the older messages, which you can still read. **Compact automatically**, under **Chat** in **Settings → Models**, does this when needed. Type **/compact** to do it now, with what to keep after it, such as `/compact keep the color decisions`.

**Conversation history**, at the top left of the chat, opens your earlier conversations, saved on this computer. **New chat** starts over.

## Choose What the AI Can Do

**Settings → Tool access** lists the tools the AI can use, such as changing layers, exporting, or running scripts. Turn tools or whole groups off to keep the AI from using them. The change applies from the next message. A script tool can still do what the turned-off tools do, so these switches aren't a sandbox.

The **Local MCP** tab sets the tools for [coding agents and other MCP clients](../developers/mcp-server).

## Change the AI's Instructions

::: v-pre

**Settings → Prompts** holds what OpenPencil tells the AI:

- **Design agent**: your instructions for the chat, added after OpenPencil's. **Replace OpenPencil's** uses yours instead; without OpenPencil's, the AI may use its tools poorly.
- **Review**, **Chat titles**, and **Compaction summaries**: the prompts for those tasks. They're [Knap](https://knap.md) templates, where `{{ focus }}` puts in a value. The editor marks mistakes and previews the result.

:::

**Reset to default** brings OpenPencil's back.

## Connect Other Tools {#external-mcp-connections}

In the desktop app, coding agents can use other [MCP](https://modelcontextprotocol.io/) servers too, such as your issue tracker. In **Settings → MCP**, under **MCP connections**, add the server's address and, if it needs one, its token. Only add servers you trust: their tools act with the access you give them.

## Get Notified

When the AI asks for permission and you don't answer within a few seconds, OpenPencil sends a notification, so you can work in another app meanwhile. **Settings → Notifications** can also notify you when a reply finishes. In the browser, click **Allow notifications** there first.
