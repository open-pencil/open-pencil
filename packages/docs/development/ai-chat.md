# AI chat replies

How the built-in AI chat turns a message into edits, how a reply ends, and how what happens to its edits afterwards reaches the transcript and the model. ACP and Pi chats share the transcript, the saved conversation, and the marks on a reply, but run their own tool loop and agent presence.

## A message goes out

`src/app/ai/chat/submission/use.ts` sends a message through the AI SDK's `Chat`. Before sending, it appends notes for the model to the text: the layers you referenced, and the edits you undid or redid since the model last heard (`context.ts`). The transcript shows only what you wrote; `stripModelNotes` removes the notes. Notes go on the newest message only. Earlier messages never change, so the provider can keep caching the conversation up to the new message.

`chat/history/continuation.ts` (`requestMessages`) leaves tool calls without a result out of the request. They stay in the saved transcript.

The model comes from `createAIModelRuntime` (`src/app/ai/models/runtime.ts`), with the connection's saved key. An `openpencil` connection has no key: it names a workspace on the Home Cloud server, and its model talks to the AI service that server's discovery advertises, through `@/app/cloud/integration` (`src/app/cloud/ai/`). Each request carries a short-lived token Cloud signs for that workspace, replaced shortly before it expires and once more when the service refuses it (`cloudAIFetch` in `packages/cloud/src/client/ai.ts`), so the service never sees the person's Cloud session.

## Skills

Skills are SKILL.md folders in the [Agent Skills](https://agentskills.io/specification) format (`src/app/ai/skills/`). The direct chat lists the enabled skills the model may load, by name and description, after its instructions (`skillCatalog`), and offers two tools while any skill is enabled: `load_skill` returns a skill's instructions and the files in its folder, and `read_skill_file` reads one of those files, never a path the skill does not list. Scripts in a skill do not run in this chat. The listing is part of the instructions a saved trace records, so a rebuilt request matches the one sent.

Every message first reads the skills again (`library.ts`): those uploaded in Settings › Skills, kept in IndexedDB as their SKILL.md and text files (`sources/uploaded.ts`), then, on the desktop, `~/.agents/skills` and `~/.claude/skills`, through the shell's `skill_folders` and `skill_folder_file` commands (`desktop/src/agents/skills.rs`). Those read only `.agents/skills` and `.claude/skills` folders, follow symlinked skills, and read nothing outside a folder with a SKILL.md. On the desktop the library also reads the `.agents/skills` and `.claude/skills` folders from the open document's folder up to its repository root, stopping below the home folder (`sources/project.ts`, `project_skill_folders`); their skills come after uploads and before the user's own, nearest folder first, and stay off until the user trusts that folder in Settings › Skills, since a skill is instructions the model follows. Uploads are on from the start; the coding agents' folders hold mostly coding workflows, so they start off, and the AI setup's review step offers their skills one by one (`AISetupSkills`, `withPickedSkills`). Settings › Skills switches sources and skills either way (`preferences.ts`, `settings/use.ts`); of two skills with the same name, the first one switched on is offered, so an upload wins over a folder. A frontmatter that is not valid YAML, usually a description with an unquoted `: `, is read line by line with a warning rather than dropped.

A message that starts with `/skill:name` runs that skill, as in pi: the request carries the skill's instructions in a note after the text (`appendSkillContext`), which the transcript leaves out, so every agent follows it without looking it up. Pi gets the enabled skills the model may load, with their text files, in its session configuration (`skills/harness.ts`), and its harness writes them into Pi's own skills folder; files past a 384 KB budget, counted in UTF-8 bytes, are left out so the configuration stays inside the harness protocol's line limit. ACP agents keep their own skills.

## References

Messages name layers, pages, and skills with Markdown links in the `openpencil:` scheme, `[Hero](openpencil://node/12:34)` (`chat/references/link.ts`), in both directions: the composer inserts them and the system prompt asks the model to cite what it touched the same way. The composer is a CodeMirror field (`components/chat/composer/`), built like the variable formula field: `@` completes layers (the current page's first, then other loaded pages'), pages, and skills (`references/candidates.ts`), and `/` at the start of a message completes the skills the user can run, or an ACP agent's own commands from `available_commands_update` (`agents/acp/commands.ts`). A reference shows as a chip that edits as one unit. The transcript renders the same chip (`ChatReferenceChip`): replies get references rewritten to an inline `chat-reference` component before Markdown renders them, so other links keep the renderer's own handling, and the user's text is split around them. The selection button inserts the selected layers as references, and the layers a message mentions go with it as previews (`references/nodes.ts`), rebuilt from the text when a sent message is edited, which also runs a `/skill:` again; a message with images still cannot be edited. Hovering a layer chip outlines the layer on the canvas. A chip follows renames, shows its written label once its target is gone, and on click shows the layer on its page, switches to the page, or opens the skill in Settings › Skills; a conversation from another document resolves nothing by ID.

## Messages while the agent works

The field stays open while a reply runs, as in pi and Claude Code (`chat/queue.ts`). Enter queues a steering message and Alt+Enter a follow-up; both show dimmed after the reply until sent. The built-in chat's tool loop also stops once the current step's tool calls finish whenever a steering message waits (`yieldWhen` in `transports/tool-loop.ts`), so that message goes in with the step's results, without the step-limit notice. When a reply ends, steering messages go first, then follow-ups, one per reply; a failed reply keeps them. ACP agents and Pi cannot take a message mid-turn, so theirs wait until the turn ends. Escape, or Stop, ends the reply and sends what waits; Up on the first line takes the waiting messages back into the field, images included; changing conversations drops them.

## A run

`transports/tool-loop.ts` starts a run (`reply/run.ts`) when the message is sent, before the model is reached, so a Stop at any point ends a run that exists. A `Run` belongs to one reply and holds:

- the page it works on, which your navigation does not move and the agent's `switch_page` does;
- the step budget captured when the message started;
- each page as it was before the run first edited it, for `diff_changes`;
- every undo entry its calls pushed, with the tool and call that pushed it;
- the calls that changed the document, and the undone calls it already told the model about.

The chat's agent is one presence entry per document (`presence/registry.ts`). It shows as thinking when the run starts and points at the layers each call changed, on whichever page they are. With Follow agents on, following starts with the run and ends when the agent rests and none of your other agents is at work. An agent you chose to follow keeps you with it while it rests.

## A tool call

Every call of an OpenPencil tool, from the chat, a coding agent through MCP, or WebMCP, runs through `runEditorTool` (`tools/runner.ts`); `tools/index.ts` passes the chat's calls with their reply:

- Calls that change a document take its lock in turn, since whole-page snapshots must not interleave. A reply's call that gets the lock after the reply ended changes nothing and returns an error.
- The document change is captured and pushed as one undo step. A reply's call labels it `aiUndoLabel(tool)` and records it on the call's own run, the one it started in, even if a later reply has begun; another client's call is labelled by its source, such as `Agent` or `WebMCP`.
- The change is recorded for the chat's change review, and the agent points at it.
- A call's result reaches the model as JSON. `eval` converts what a script returns, as MCP and the CLI print it.
- If you undid or redid the run's own edits since the model last heard, the result carries an `undoNote` saying so.

## Images a tool returns

An image a call returns, such as `export_image`'s, reaches the model as a file, and every request sends the whole conversation again. On a connection whose provider documents WebP input itself (Anthropic, OpenAI, Google Gemini, and DeepSeek: `webpImages` in `providers/registry.ts`, each beside its documentation link), a PNG goes as WebP at quality 90 (`tools/model-image.ts`), unless the WebP comes out larger, as it can for flat renders.

- Measured at the 1280 px default edge on design renders: flat UI is 14–20 KB as PNG and barely smaller as WebP; renders with imagery are 197–289 KB as PNG and 61–86 KB as WebP, at SSIM 0.984–0.995 against the PNG, with small text as legible.
- Only a provider's own documentation counts. An Anthropic- or OpenAI-compatible endpoint, OpenRouter, Z.ai, MiniMax, ChatGPT sign-in, and Cloud may forward to a model server that cannot decode WebP (llama.cpp's server reads images with stb_image, which has none), so they get PNG.
- JPEG is never chosen for the model: our export paints transparent pixels black.
- Core's adapter encodes the image as each request is built (`encodeModelImage` in `tools/ai-adapter.ts`), once per tool call, and the result keeps the tool's PNG, so a conversation continued on a PNG-only connection still sends PNG.
- The app loads CanvasKit's full build, which encodes WebP and JPEG, because a WebView cannot be relied on: WKWebView answers a canvas asked for WebP with PNG.
- Chat Completions takes only text in a tool message, and the AI SDK sends a tool's image there as its Base64 text. On the connections that use it (MiniMax, Cloud, and an OpenAI-compatible endpoint set to Chat Completions), `providers/tool-images.ts` moves each image into a user message after the step's tool results, as opencode does. The same history always gives the same messages, so cached prefixes still match.

## A reply ends

A run ends once, in one of three ways: finished (`onFinish`), failed (`handleError`), or stopped (the request's abort signal). The agent goes idle and its cursor leaves the canvas. A tool already running keeps going: its edit lands in its run, but cannot move the agent again.

When the chat's own `onFinish` reports a reply that was stopped, failed, or cut off, `settleEndedReply` waits for the run's last edit, then settles the message (`reply/settle.ts`):

- reasoning and text are marked done;
- each call that never reported back fails with whether it changed the document, which the model reads next time;
- a stopped reply is marked stopped.

Diagnostics record `chat.completed`, `chat.stopped`, or `chat.failed`.

A reply that finished or failed on its own, rather than one you stopped or one cut off by a disconnect, also reaches `notifyReplyEnded` (`chat/notifications.ts`). It quotes the last text part as plain text and sends it through the shared notification service (`shell/notifications/`), which sends nothing while you are looking at that document. An ACP agent's permission request that is still unanswered after `AGENT_INPUT_NOTIFY_DELAY_MS` notifies through the same service, by the `onUnanswered` callback of `requestPermissionFromUser`.

`reply/undo.ts` records the reply's turn (`reply/turns.ts`) once the run settles, so an edit landing after Stop belongs to the reply.

## An ACP reply

An ACP agent calls OpenPencil's tools through the MCP server, and its replies keep their edits the same way. The ACP transport (`transports/acp.ts`) starts a run for each reply with `startAgentRun`, without the built-in chat's agent presence, since the agent shows through its MCP session, and ends it however the reply ends. Each MCP tool call carries the chat id from the agent's `x-openpencil-chat` header and the call's id in the agent's conversation, which Codex sends as `_meta.callId` and Claude Code as `_meta["claudecode/toolUseId"]`. While the reply goes on, a call that edits the chat's own document joins the run through `runEditorTool`, which `automation/bridge/tool-handlers.ts` calls with the reply, so Revert, Restore, and the undone marks work as for a provider model.

## Undo and the model

A turn keeps the reply's calls and their undo entries. On every undo history change, each turn works out which of its calls are undone with `UndoManager.stateOf`: an entry on the redo stack is undone, one on the undo stack applied. An entry that left the history keeps its last state; undone and then cleared from Redo by a new edit, it stays undone. Changes are written to the reply's metadata, and the transcript reads only the metadata.

Edit → Undo and the chat's **Revert changes** therefore end in the same state: Revert undoes the reply's edits still applied, when they are the newest on the undo stack, and **Restore changes** redoes its undone edits, when Redo would bring exactly those back next.

`undoToReport` compares each reply's undone calls with what the model was last told, and the next message carries the difference as a note. The report records the message that carried it. If that message is sent again, for example when you edit it, the report is made again.

## Saved conversations

A reply's metadata (`chat/metadata.ts`) keeps whether you stopped it, and its edits with those undone and what the model was last told. Conversations save messages with `structuredClone`, so metadata is written from the plain message, never from the chat's reactive copy. Reopening a conversation settles any reply saved mid-way. The undo history does not survive closing a document, so a reopened reply keeps its marks but offers no Revert or Restore.

## Traces

Save trace… in the conversation menu writes a file to reproduce what the agent did (`chat/trace/export.ts`). It holds the conversation's messages, its runs, and its diagnostic events.

A run is one message sent and every step the model took to answer it (`chat/trace/recorder.ts`). It records the model and settings, the last message sent, and per step the response's finish reason, usage, warnings, and duration; a failed run keeps the error, and the step that failed is the one after the last recorded. Instructions and the tools offered are stored once under their fingerprints and shared by every run that used them.

A step's request is not stored. It is the conversation through the run's last message, as `requestMessages` prepared it, plus the reply's earlier steps; `chat/trace/rebuild.ts` rebuilds it and compares its fingerprint with the one recorded when the step ran, so a rebuild that no longer matches what was sent is reported instead of replayed. Runs live in the chat database beside their conversation and are deleted with it.
