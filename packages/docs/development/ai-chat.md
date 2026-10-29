# AI chat replies

How the built-in AI chat turns a message into edits, how a reply ends, and how what happens to its edits afterwards reaches the transcript and the model. ACP and Pi chats share the transcript, the saved conversation, and the marks on a reply, but run their own tool loop and agent presence.

## A message goes out

`src/app/ai/chat/submission/use.ts` sends a message through the AI SDK's `Chat`. Before sending, it appends notes for the model to the text: the layers you referenced, and the edits you undid or redid since the model last heard (`context.ts`). The transcript shows only what you wrote; `stripModelNotes` removes the notes. Notes go on the newest message only. Earlier messages never change, so the provider can keep caching the conversation up to the new message.

`chat/history/continuation.ts` (`requestMessages`) leaves tool calls without a result out of the request. They stay in the saved transcript.

The model comes from `createAIModelRuntime` (`src/app/ai/models/runtime.ts`), with the connection's saved key. An `openpencil` connection has no key: it names a workspace on the Home Cloud server, and its model talks to the AI service that server's discovery advertises, through `@/app/cloud/integration` (`src/app/cloud/ai/`). Each request carries a short-lived token Cloud signs for that workspace, replaced shortly before it expires and once more when the service refuses it (`cloudAIFetch` in `packages/cloud/src/client/ai.ts`), so the service never sees the person's Cloud session.

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

## A reply ends

A run ends once, in one of three ways: finished (`onFinish`), failed (`handleError`), or stopped (the request's abort signal). The agent goes idle and its cursor leaves the canvas. A tool already running keeps going: its edit lands in its run, but cannot move the agent again.

When the chat's own `onFinish` reports a reply that was stopped, failed, or cut off, `settleEndedReply` waits for the run's last edit, then settles the message (`reply/settle.ts`):

- reasoning and text are marked done;
- each call that never reported back fails with whether it changed the document, which the model reads next time;
- a stopped reply is marked stopped.

Diagnostics record `chat.completed`, `chat.stopped`, or `chat.failed`.

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
