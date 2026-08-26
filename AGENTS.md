# Agent Guidelines

## Workspace & Project Scope Rules

- **Never Modify Code in Other Projects**: Under no circumstances should code or files be created, edited, or modified in external project directories (such as `jojira-duffel` or any other directory outside `jojira-ui`). All code edits, refactoring, and file creation must remain strictly scoped to the active project workspace (`jojira-ui`).
- **Never Update Scripts in Other Folders**: Do not modify, edit, or update scripts, configuration files, or source code located in folders outside the active project workspace (`jojira-ui`).
- **Do Not Execute Scratchpad Files Automatically**: Under no circumstances should scratchpad Markdown files, temporary scratch notes, or scratchpad tasks be executed automatically, in order to avoid unnecessary token burn.

## Code Design & Architecture Rules

- **Always Modularize the Code**: Design software in decoupled, single-responsibility modules and components with clear interfaces.
- **Create Reusable Code**: Write functions, classes, and utilities designed for maximum reusability across services, adapters, and UI components.
- **Reuse Code As Much As Possible**: Always inspect existing modules and helper functions before implementation. Reuse pre-existing utilities, abstractions, and functions rather than re-creating duplicate or overlapping logic.

## Token & Communication Efficiency Rules

- **Minimize Input and Output Tokens**: Keep messages, responses, and tool usage concise to optimize token consumption. Avoid unnecessary context dumping, redundant tool calls, or oversized responses.
- **Omit Unsolicited Explanations**: Do not provide default explanations, background rationale, or code walkthroughs unless explicitly requested by the user. Report completed actions concisely or present requested changes directly.

