# Coding agents

The OpenPencil desktop app can use a coding agent you already have — Claude Code, Codex, Gemini CLI, or [Pi](#pi) — as its design agent. The agent runs on your computer with your own subscription and chooses its own model; OpenPencil starts it when you send a message, through the [Agent Client Protocol](https://agentclientprotocol.com/) or, for Pi, its Harness companion, and gives it the canvas tools through OpenPencil's local [MCP server](./mcp-server).

Coding agents need the desktop app; the browser cannot start programs on your computer. They take only the **Design agent** role. Visual review, plan reviews, and fast background work need an API model, which guided setup can add for you.

## What you need

1. The [OpenPencil desktop app](https://github.com/open-pencil/open-pencil/releases/latest).
2. The agent's ACP program, installed globally (see each agent below).
3. OpenPencil's MCP server, installed globally. Use the version that matches your app:

   ```sh
   npm install -g @open-pencil/mcp
   ```

4. The agent signed in to your account with its own command-line tool.

Then open **Settings → AI & agents → Run guided setup**, choose the agent under **Coding agents on this computer**, and check that both the agent and the MCP server show as installed. **Check again** looks again after you install something.

### Let your agent set itself up

If you already use one of these agents in a terminal, guided setup can do the typing for you: press **Copy setup prompt** on the agent's card and paste the prompt into the agent. It asks the agent to install its ACP program and the MCP server, confirm both are on your `PATH`, and make sure you are signed in.

## Claude Code

```sh
npm install -g @agentclientprotocol/claude-agent-acp
```

Sign in by running `claude` and using `/login`. The ACP program uses the same account as Claude Code.

## Codex

```sh
npm install -g @agentclientprotocol/codex-acp
```

Sign in with `codex login`.

## Gemini CLI

```sh
npm install -g @google/gemini-cli
```

Gemini CLI speaks ACP itself, so there is no separate program. Run `gemini` once and choose a sign-in method.

## Pi

Pi runs through OpenPencil's Harness companion instead of ACP. It needs Node.js 22.15 or later, or Bun. Guided setup installs the companion with one click; to install it yourself, use the version that matches your app:

```sh
npm install -g @open-pencil/harness
```

OpenPencil uses the providers you signed in to in Pi and Pi's default model, so there is no key to paste. Sign in by running `pi` and using `/login`, and pick a default model with `/model`. To use another model in OpenPencil, enter it as `provider/model` in the Pi model's settings. An [AI Gateway](https://vercel.com/ai-gateway) key is optional; when you save one, Pi uses the gateway instead of your Pi sign-ins.

OpenPencil reads only Pi's `settings.json` for the default model; your credentials stay with Pi. Your Pi extensions, themes, and prompt templates are not loaded into OpenPencil's sessions. Pi keeps a conversation's context while it runs; after Pi or OpenPencil restarts, the conversation continues in a fresh Pi session, because Pi's workspace lives in memory.

## Troubleshooting

- **Shown as not found after installing.** Apps started from the Dock or Start menu do not see every folder your terminal adds to `PATH`. OpenPencil also looks in common global folders for npm, Bun, Volta, mise, and Homebrew; if your package manager installs elsewhere, add that folder to your login shell's `PATH` and restart OpenPencil.
- **Shown as update needed.** The MCP server or Pi's companion does not match the app version. Press the update button, or run the command guided setup shows with the package manager that installed it, then press **Check again**. A chat that needs it says so and offers **Run guided setup**.
- **The agent starts but cannot edit the canvas.** The MCP server is missing or not running. Install the matching `@open-pencil/mcp` version and restart OpenPencil.
- **The agent asks you to sign in.** Sign in with the agent's own command-line tool as described above, then send your message again.
