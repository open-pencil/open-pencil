# Coding agents

The OpenPencil desktop app can use a coding agent you already have — Claude Code, Codex, Gemini CLI, or [Pi](#pi) — as its design agent. The agent runs on your computer with your own subscription and chooses its own model; OpenPencil starts it when you send a message, through the [Agent Client Protocol](https://agentclientprotocol.com/) or, for Pi, its Harness companion, and gives it the canvas tools through OpenPencil's local [MCP server](./mcp-server).

Coding agents need the desktop app; the browser cannot start programs on your computer. They take only the **Design agent** role. Visual review, plan reviews, and fast background work need an API model, which guided setup can add for you.

## What you need

1. The [OpenPencil desktop app](/download).
2. The agent's ACP program, installed globally (see each agent below). Claude Code's and Codex's ACP programs include the agent, so their own command-line tools are optional.
3. OpenPencil's MCP server, installed globally. Use the version that matches your app:

   ```sh
   npm install -g @open-pencil/mcp
   ```

4. The agent signed in to your account. Pi can use an AI Gateway key instead (see [Pi](#pi)).

Then open **Settings → AI & agents → Run guided setup**, choose the agent under **Coding agents on this computer**, and check that both the agent and the MCP server show as installed. **Install adapter** runs the npm command shown under it. Once the ACP program is installed, guided setup asks the agent which account it uses and shows what it reports, such as the plan and email; when it is not signed in, **Sign in** opens the agent's own login in your browser. For a signed-in agent, **OpenPencil tools** shows whether a session reaches OpenPencil's MCP server, checked the way a chat starts, without sending a message. **Check again** repeats the check after you install something or sign in elsewhere.

### Let your agent set itself up

If you already use one of these agents in a terminal, guided setup can do the typing for you: press **Copy setup prompt** on the agent's card and paste the prompt into the agent. It asks the agent to install its ACP program and the MCP server, confirm both are on your `PATH`, and make sure you are signed in.

## Claude Code

```sh
npm install -g @agentclientprotocol/claude-agent-acp
```

Sign in from guided setup, or by running `claude` and using `/login`. The ACP program uses the same account as Claude Code. If the browser cannot hand the sign-in back, the sign-in page shows a code to paste into guided setup.

## Codex

```sh
npm install -g @agentclientprotocol/codex-acp
```

Sign in with ChatGPT from guided setup, or with `codex login`; both use the same account.

An older adapter from the `@zed-industries/codex-acp` package also installs a `codex-acp` program. It neither reports nor signs in to your account, so guided setup asks you to install the supported one and to remove the older one or put it later on your `PATH`.

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
- **The agent couldn't reach OpenPencil's tools.** Before sending your message, OpenPencil waits for the agent to connect to its MCP server and stops if it does not, quoting the agent's reason when it gives one. Check that the MCP server shows as installed in guided setup and is running in **Settings → MCP**. Codex skips OpenPencil's server when its own `config.toml` defines a server named `open-pencil`; remove that entry.
- **The agent starts but cannot edit the canvas.** The MCP server is missing or not running. Install the matching `@open-pencil/mcp` version and restart OpenPencil.
- **Where the agent works.** Chats start the agent in a folder of its own inside OpenPencil's app data, not your home folder, so it does not pick up project settings kept there. The agent still uses its own configuration, such as the MCP servers and rules in `~/.codex` or `~/.claude`.
- **The agent asks you to sign in.** Press **Sign in** in guided setup, or sign in with the agent's own command-line tool as described above, then send your message again.
