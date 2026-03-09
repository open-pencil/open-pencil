# eval-command Specification

## Purpose
CLI command `open-pencil eval <file>` for executing JavaScript against .fig files with a Figma-compatible `figma` global object. Enables headless scripting, batch operations, AI tool execution, and testing without GUI. Supports `--code`, `--stdin`, `--write`, `-o`, and `--json` flags.

## Requirements

### Requirement: Execute JavaScript against .fig files

The system SHALL provide `bun open-pencil eval <file> --code '<js>'` command for headless JavaScript execution.

#### Scenario: Running inline code
- **WHEN** user runs `bun open-pencil eval design.fig --code 'return figma.currentPage.children.length'`
- **THEN** system loads design.fig, executes code with `figma` global, prints result to stdout

#### Scenario: Returning JSON
- **WHEN** user runs `bun open-pencil eval design.fig --code 'return { id: figma.currentPage.id }'`
- **THEN** system serializes result as JSON and prints

#### Scenario: Code with no return
- **WHEN** user runs code that doesn't return a value
- **THEN** system prints `undefined`

### Requirement: Read code from stdin

The system SHALL support `--stdin` flag for reading multiline scripts.

#### Scenario: Piping script file
- **WHEN** user runs `cat script.js | bun open-pencil eval design.fig --stdin`
- **THEN** system reads script from stdin and executes

#### Scenario: Heredoc input
- **WHEN** user runs eval with heredoc `<<EOF` and multiline script
- **THEN** system reads until EOF and executes

### Requirement: Write changes back to file

The system SHALL support `--write` and `-o` flags for persisting modifications.

#### Scenario: Writing changes in-place
- **WHEN** user runs `bun open-pencil eval design.fig --code 'frame.name = "Updated"' --write`
- **THEN** system modifies design.fig in-place after execution

#### Scenario: Writing to output file
- **WHEN** user runs `bun open-pencil eval design.fig --code '...' -o modified.fig`
- **THEN** system writes modified scene graph to modified.fig, leaving original unchanged

#### Scenario: Read-only by default
- **WHEN** user runs eval without --write or -o
- **THEN** system does not modify the input file

### Requirement: Figma global object available

The system SHALL provide a `figma` global object matching Figma's Plugin API surface.

#### Scenario: Accessing figma object
- **WHEN** code accesses `figma.currentPage`, `figma.root`, `figma.createFrame()`
- **THEN** system provides FigmaAPI instance bound to loaded document

#### Scenario: Creating nodes
- **WHEN** code calls `figma.createFrame()`, `figma.createRectangle()`, etc.
- **THEN** system creates nodes in scene graph

#### Scenario: Querying nodes
- **WHEN** code calls `figma.currentPage.findAll(n => n.type === "FRAME")`
- **THEN** system traverses scene graph and returns matching nodes

### Requirement: Document loading and unloading

The system SHALL load .fig files before execution and manage cleanup.

#### Scenario: Loading document
- **WHEN** eval command starts
- **THEN** system deserializes .fig file into SceneGraph

#### Scenario: Invalid file
- **WHEN** user provides non-existent or corrupted .fig file
- **THEN** system exits with error message

### Requirement: Error handling

The system SHALL report JavaScript execution errors with stack traces.

#### Scenario: Runtime error
- **WHEN** code throws an exception (e.g., accessing property on undefined)
- **THEN** system prints error message and stack trace to stderr

#### Scenario: Syntax error
- **WHEN** code has invalid JavaScript syntax
- **THEN** system reports syntax error before execution

### Requirement: Structured output option

The system SHALL support `--json` flag for machine-readable output.

#### Scenario: JSON output
- **WHEN** user runs `bun open-pencil eval design.fig --code '...' --json`
- **THEN** system formats result as JSON (even if code doesn't return object)

#### Scenario: JSON with errors
- **WHEN** execution fails with --json flag
- **THEN** system outputs `{ "error": "message", "stack": "..." }` as JSON

### Requirement: Integration with AI tools

The system SHALL enable AI-driven design automation via eval execution.

#### Scenario: AI tool calls eval
- **WHEN** AI tool invokes eval command with generated code
- **THEN** system executes code and returns result for AI to process

#### Scenario: Batch operations
- **WHEN** AI generates loop over nodes (e.g., rename all buttons)
- **THEN** system executes batch modifications efficiently

### Requirement: Console output support

The system SHALL allow `console.log()` for debugging.

#### Scenario: Logging during execution
- **WHEN** code calls `console.log("Debug:", value)`
- **THEN** system prints to stdout before final result

### Requirement: Access to Bun APIs

The system SHALL allow code to use Bun runtime APIs. Eval runs in a trusted local context (same as the CLI itself) — no sandboxing is applied.

#### Scenario: File I/O from eval code
- **WHEN** code uses `Bun.file()`, `Bun.write()`, etc.
- **THEN** system allows file operations (trusted headless context)

#### Scenario: Fetch from eval code
- **WHEN** code uses `fetch()` to call external API
- **THEN** system executes network request

### Requirement: CLI integration

The system SHALL integrate eval command into `@open-pencil/cli` package.

#### Scenario: Command registration
- **WHEN** CLI loads commands
- **THEN** eval command appears in `bun open-pencil --help`

#### Scenario: Command structure
- **WHEN** user runs `bun open-pencil eval --help`
- **THEN** system displays usage, flags (--code, --stdin, --write, -o, --json), and examples
