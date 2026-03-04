# demo-recording Specification

## Purpose
TBD - created by archiving change add-webreel-demos. Update Purpose after archive.
## Requirements
### Requirement: Demo recording workspace package
The project SHALL have a `packages/demos` workspace package that is private and contains webreel as an npm dependency for scripted demo recording.

#### Scenario: Package exists in workspace
- **WHEN** `bun install` is run at the project root
- **THEN** `packages/demos` is resolved as a workspace member with `webreel` installed

### Requirement: Scenario config file
Demo scenarios SHALL be defined in a single `packages/demos/webreel.config.json` with a `videos` object containing named video entries (idiomatic webreel pattern). Videos target `http://localhost:1420/` using `data-test-id` selectors.

#### Scenario: Config file is valid webreel config
- **WHEN** `packages/demos/webreel.config.json` exists
- **THEN** it SHALL be a valid webreel config with `$schema`, `videos` object, and steps using `data-test-id` selectors

### Requirement: Record all demos
The project SHALL provide a `bun run demo:record` command at the root that records all scenario configs and writes output to `packages/demos/videos/`.

#### Scenario: Record all scenarios
- **WHEN** the dev server is running at `http://localhost:1420/` and `bun run demo:record` is executed
- **THEN** all videos in `packages/demos/webreel.config.json` are recorded and output is written to `packages/demos/videos/`

### Requirement: Record single demo by name
The project SHALL support `bun run demo:record --scenario <name>` to record a specific video from the config.

#### Scenario: Record named scenario
- **WHEN** the dev server is running and `bun run demo:record --scenario toolbar` is executed
- **THEN** only the `toolbar` video is recorded

### Requirement: Videos excluded from git
Generated video files and webreel working directories SHALL be excluded from version control via `.gitignore`.

#### Scenario: Git ignores demo outputs
- **WHEN** demos are recorded and `git status` is run
- **THEN** files in `packages/demos/videos/` and `packages/demos/.webreel/` do not appear as untracked

### Requirement: Starter toolbar demo scenario
A starter scenario SHALL exist demonstrating toolbar tool switching using the `data-test-id` attributes on toolbar buttons.

#### Scenario: Toolbar demo records successfully
- **WHEN** the dev server is running and the toolbar scenario is recorded
- **THEN** a video is produced showing cursor movement between toolbar tool buttons

