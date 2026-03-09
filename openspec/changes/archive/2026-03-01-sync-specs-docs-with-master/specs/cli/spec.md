## ADDED Requirements

### Requirement: Eval command for headless scripting

The CLI SHALL provide `open-pencil eval <file>` command for executing JavaScript against .fig files with a Figma-compatible `figma` global object.

#### Scenario: Inline code execution
- **WHEN** `bun open-pencil eval design.fig --code 'return figma.currentPage.children.length'` is run
- **THEN** system loads design.fig, executes code, and prints result

#### Scenario: Reading code from stdin
- **WHEN** `cat script.js | bun open-pencil eval design.fig --stdin` is run
- **THEN** system reads script from stdin and executes

#### Scenario: Writing changes back
- **WHEN** `bun open-pencil eval design.fig --code 'frame.name = "Updated"' --write` is run
- **THEN** system modifies design.fig in-place after execution

#### Scenario: Writing to output file
- **WHEN** `bun open-pencil eval design.fig --code '...' -o modified.fig` is run
- **THEN** system writes modified document to modified.fig

#### Scenario: JSON output
- **WHEN** `bun open-pencil eval design.fig --code '...' --json` is run
- **THEN** system formats result as JSON

#### Scenario: Figma API access
- **WHEN** eval code accesses `figma.createFrame()`, `figma.currentPage.findAll()`, etc.
- **THEN** system provides FigmaAPI instance bound to loaded document

#### Scenario: Error handling
- **WHEN** eval code throws error
- **THEN** system prints error message and stack trace to stderr

## MODIFIED Requirements

### Requirement: CLI commands

The CLI SHALL support the following commands:
- `open-pencil info <file>` — document stats, node type counts, font list
- `open-pencil tree <file>` — visual node tree with formatted output
- `open-pencil find <file>` — search nodes by name or type
- `open-pencil export <file>` — render to PNG/JPG/WEBP at any scale
- `open-pencil analyze colors <file>` — color palette usage with clustering
- `open-pencil analyze typography <file>` — font/size/weight distribution
- `open-pencil analyze spacing <file>` — gap/padding values with grid alignment check
- `open-pencil analyze clusters <file>` — repeated patterns (potential components)
- `open-pencil node <file> <id>` — detailed properties of a specific node
- `open-pencil pages <file>` — list pages with node counts
- `open-pencil variables <file>` — list design variables and collections
- **`open-pencil eval <file>` — execute JavaScript with Figma Plugin API (NEW)**

All commands SHALL support `--json` for machine-readable output.

#### Scenario: Info command
- **WHEN** `bun open-pencil info design.fig` is run
- **THEN** document stats, node type counts, and font list are printed

#### Scenario: Export command
- **WHEN** `bun open-pencil export design.fig --format png --scale 2` is run
- **THEN** the document is rendered headlessly and exported as 2× PNG

#### Scenario: JSON output
- **WHEN** `bun open-pencil tree design.fig --json` is run
- **THEN** the node tree is output as JSON

#### Scenario: Eval command
- **WHEN** `bun open-pencil eval design.fig --code 'return figma.currentPage.children.length'` is run
- **THEN** system executes JavaScript with `figma` global and prints result
