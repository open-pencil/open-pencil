---
pageClass: guide
title: Coding Agents
description: Use Claude Code, Codex, Cursor, or another coding agent you already have as the AI in the OpenPencil desktop app.
---

# Coding Agents

The desktop app can use a coding agent you already have as its AI: Claude Code, Codex, [Antigravity CLI](#antigravity), Gemini CLI, [Cursor](#cursor), [Grok Build](#grok-build), or [Pi](#pi). The agent runs on your computer with your own subscription, and OpenPencil gives it the tools to work on the canvas.

Coding agents need the [desktop app](/download): the browser can't start programs on your computer.

## Set Up an Agent

1. Install the agent's connector, as its section below shows. Claude Code and Codex need no other program.
2. Install OpenPencil's MCP server, which gives the agent the canvas tools:

   ```sh
   npm install -g @open-pencil/mcp
   ```

3. Open **Settings → Models → Run guided setup** and choose the agent under **Coding agents on this computer**.
4. Check that the agent and the MCP server show as installed. **Install adapter** installs the connector for you.
5. If the agent isn't signed in, click **Sign in**. Guided setup shows the account the agent uses, such as its plan and email.

**OpenPencil tools** shows whether the agent can reach the canvas tools. **Check again** looks again after you install something or sign in.

If you already use the agent in a terminal, it can set itself up: click **Copy setup prompt** on its card and paste the prompt into the agent.

## Choose the Model and Mode

An agent is a model like any other in **Settings → Models**, so it can be the **Design agent**, do **Fast tasks**, write **Reviews**, or, when it reads images, be the **Vision** model. You can add the same agent twice with different settings.

In an agent's settings:

- **Model**: **Agent default** leaves the choice to the agent, or pick one of the models it offers. If the list doesn't load, choose **Custom model…** and type a model's ID.
- **Thinking level**: the agent's own levels for the model you picked, such as Claude Code's Max or Codex's Ultra.
- **Mode**: what the agent may do before asking you, by the agent's own names, such as Claude Code's Manual, Accept edits, Plan, Auto, and Bypass permissions, or Codex's Read-only through Full access.
- **Image input**: turn it off when the model you picked can't read images.

The menu next to the send button changes the model, thinking level, and mode for the chat you're in, from the next message.

## Claude Code

```sh
npm install -g @agentclientprotocol/claude-agent-acp
```

Sign in from guided setup, or run `claude` and type `/login`. If the browser can't hand the sign-in back, the sign-in page shows a code to paste into guided setup.

## Codex

```sh
npm install -g @agentclientprotocol/codex-acp
```

Sign in with ChatGPT from guided setup, or run `codex login`.

An older connector, `@zed-industries/codex-acp`, installs a program with the same name but can't sign in. Guided setup asks you to remove it.

## Antigravity CLI {#antigravity}

Antigravity CLI is Google's agent for Gemini. It needs no connector. Install it from the [Antigravity site](https://antigravity.google):

```sh
curl -fsSL https://antigravity.google/cli/install.sh | bash
```

On Windows, run this in PowerShell instead:

```powershell
irm https://antigravity.google/cli/install.ps1 | iex
```

Run `agy` once and choose how to sign in. Guided setup shows it as installed, but can't show its account.

Before it starts, the agent sometimes asks to list its own folder, `~/.gemini/antigravity-cli/mcp`. Allow it: declining ends its turn.

## Gemini CLI

```sh
npm install -g @google/gemini-cli
```

It needs no connector. Run `gemini` once and choose how to sign in. Personal Google accounts can no longer sign in to Gemini CLI: use [Antigravity CLI](#antigravity) with those.

## Cursor

Cursor's CLI needs no connector. Install it from the [CLI installation guide](https://cursor.com/docs/cli/installation):

```sh
curl https://cursor.com/install -fsS | bash
```

On Windows, use the PowerShell command on that page. Run `cursor-agent login` once to sign in. Cursor's models include their thinking level in their names.

## Grok Build

Grok Build needs no connector. Install it from the [Grok Build guide](https://docs.x.ai/build/overview):

```sh
curl -fsSL https://x.ai/cli/install.sh | bash
```

On Windows, use the PowerShell command on that page. Run `grok login` once to sign in.

## Pi

Pi runs through OpenPencil's companion program, which needs Node.js 22.15 or later, or Bun. Guided setup installs it with one click, or install it yourself:

```sh
npm install -g @open-pencil/harness
```

Pi uses the providers you signed in to in Pi, so there's no key to paste. Run `pi`, sign in with `/login`, and pick a default model with `/model`. To use another model in OpenPencil, type it as `provider/model` in Pi's settings in OpenPencil. With an [AI Gateway](https://vercel.com/ai-gateway) key, Pi uses the gateway instead.

Pi can't read images. After Pi or OpenPencil restarts, a conversation goes on in a new Pi session.

## Troubleshooting

- **Not found after installing.** Apps started from the Dock or Start menu don't see every folder your terminal does. OpenPencil looks in the usual folders for npm, Bun, Volta, mise, and Homebrew. If yours is elsewhere, add it to your login shell's `PATH` and restart OpenPencil.
- **Update needed.** The MCP server or Pi's companion doesn't match the app's version. Click the update button, or run the command guided setup shows, then **Check again**.
- **The agent can't reach OpenPencil's tools** or can't edit the canvas. Check that the MCP server shows as installed in guided setup and is running in **Settings → MCP**. Codex skips OpenPencil's server when its own `config.toml` has a server named `open-pencil`: remove that entry.
- **The agent asks you to sign in.** Click **Sign in** in guided setup, or sign in with the agent's own command, then send your message again.

The agent works in a folder of its own in OpenPencil's app data, so it doesn't pick up project settings from your home folder. It still uses its own settings, such as the MCP servers and rules in `~/.codex` or `~/.claude`.
