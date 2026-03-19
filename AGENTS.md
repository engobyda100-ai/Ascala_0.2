# AGENTS.md

## Project overview
This is a Next.js + TypeScript + Tailwind + shadcn/ui app for Ascala.

## Goal
Replace the current centered intake form homepage with a single-page intake workspace.

## Product direction
The new homepage must be a 3-panel dashboard:
- Left: Project Assets
- Center: ASCALA Intake Agent chat
- Right: Validation Suite on top and Results on bottom

Everything must happen on one page.
Do not build a multi-step wizard.
Do not navigate away from the page after running tests.
Do not restore the old single-form homepage flow.

## UI requirements
- Keep the existing styling direction and shadcn/ui approach
- Optimize for desktop first
- Keep panels modular and typed
- Keep the layout stable during interactions
- Make each panel scroll independently where appropriate

## Coding rules
- Inspect relevant existing files before making changes
- Reuse existing backend pipeline where possible
- Do not rewrite backend architecture unless explicitly asked
- Make minimal necessary changes
- Keep TypeScript types clean and explicit
- Avoid breaking compilation
- Use placeholder/mock behavior first when backend wiring is not yet implemented
- After each task, summarize:
  1. files created
  2. files changed
  3. what is still mocked or placeholder

## Existing constraints
- Current backend route may still expect a narrow payload
- Frontend redesign should happen first
- Keep results in the bottom-right panel instead of replacing the page
