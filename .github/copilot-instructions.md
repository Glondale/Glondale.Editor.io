# Copilot instructions for Glondale.Editor.io

This repo is a browser-based interactive-fiction Editor + Player with no bundler. React (18) is loaded from esm.sh and components use `React.createElement` style. The app serves `index.html` directly and mounts from `src/main.js`.

## How to run and test
- Local dev: serve the repo root with any static server (e.g. Python). The app bootstraps at `index.html` and loads `/src/main.js`.
- Minimal: `python3 -m http.server` then open http://localhost:8000
- Tests: Node-based tests live under `tests/` and `src/engine/__tests__/`. Package script runs one test: `npm test` (node --test tests/storyEngine.validateCurrentState.test.js). Some files like `validation_test.js` are browser-oriented and log diagnostics when opened in the browser.

## Architecture (big picture)
- UI Entrypoint: `src/App.js` toggles between Editor and Player experiences and passes adventure data to the player (`GameScreen`).
- Editor surface: `src/components/editor/` with three core areas:
  - `core/` Canvas + Toolbar + Sidebar (scene graph editing, node selection, context menus)
  - `dialogs/` Modals for editing scenes, choices, flags, history, search, etc.
  - Panels (e.g., `SearchPanel`) and advanced editors (Inventory, AdvancedChoice, Achievements, Stats).
- Command system: `src/commands/EditorCommands.js` + `src/services/CommandHistory.js` provide undo/redo. Editor actions dispatch command objects; do not mutate state directly when a command exists.
- Editor persistence: `src/engine/EditorSessionStorage.js` stores projects (auto-save every 30s). `EditorScreen` composes the current adventure from canvas nodes via `generateAdventureData()`.
- Validation: `src/services/ValidationService.js` emits events (`validation-complete`, etc.) used by `EditorScreen` to update error/warning badges. Backups/variants exist under `ValidationService_clean.js` and `ValidationService_backup.js`.
- Runtime engine (player): `src/engine/StoryEngine.js` orchestrates scenes, conditions, and actions using helpers: `ChoiceEvaluator`, `ConditionParser`, `StatsManager`, `InventoryManager`, and save systems.
- Types/docs: `src/types/*.js` describe the Adventure, GameState, and SaveData shapes.

## Data model and flows
- Editor keeps a Map of scene nodes and derives `adventure.scenes` for export/run. Cross-feature data on the adventure object includes: `stats`, `inventory`, `achievements`, `flags`, `categories`, and `crossGameCompatibility`.
- Choices carry `conditions`, `secretConditions`, `actions`, `requirements`, etc. Connections are derived from `choice.targetSceneId` and cached for performance.
- Export/import: `EditorScreen` offers export (JSON/YAML/XML) and import. Player uses the exported `adventure` shape directly.

## UI conventions
- React via CDN: import React from `https://esm.sh/react@18` and create elements with `React.createElement`. Avoid JSX and bundlers.
- Styling: Tailwind via CDN in `index.html` (use utility classes directly in `className`).
- Dialogs/panels are function components that return `null` when closed; state is kept in `EditorScreen` and passed down as props.
- Use `Button` from `src/components/common/Button.js` for consistent buttons.

## Commands/Handlers pattern (Editor)
- For scenes and choices, prefer creating command instances (e.g., `new UpdateNodeCommand(...)`, `new UpdateChoiceCommand(...)`) and call `commandHistory.executeCommand(cmd)` to ensure undo/redo works.
- Direct setState is acceptable for adventure-wide lists (e.g., `flags`, `stats`) when no specific command exists, but keep `metadata.modified` updated and set `hasUnsavedChanges`.
- Connections: call `generateConnections(nodeId)` after choice/target updates to refresh edges.

## Validation integration
- Debounced in `EditorScreen` (400ms) after nodes/adventure changes. Use `validationService.validate(adventure, { realTimeMode: true })`. Listen to events rather than awaiting results inline.

## Adding features (examples)
- New modal: place under `src/components/editor/dialogs/`, render it in `EditorScreen`, and toggle with local state. Example: `FlagEditor` added with `showFlagEditor` and handlers to add/update/delete items in `adventure.flags`.
- Sidebar action: add a prop like `onOpenFlagsEditor` to `EditorSidebar` and render a small `Button` to open the dialog.
  - Current behavior: the Flag Manager modal lists existing flags with Edit/Delete actions. Save will update if the ID exists, or add if it’s new. Delete is available when the form matches an existing flag.
 - Flag selection UX: All flag fields across editors are dropdowns now. When a flag is being selected (actions/conditions), a “+ Add Flag” button appears inline. Clicking it opens `FlagEditor` and, on save, auto-selects the new flag in the originating dropdown.
   - Plumbing: `EditorScreen` exposes `onInlineAddFlag(cb)` which opens `FlagEditor` and invokes `cb(newFlag)` after save. This is passed to `SceneEditDialog`, `AdvancedChoiceDialog`, and both ConditionBuilder variants. These components use it to wire their inline “+ Add Flag” buttons.
   - Data flow: `availableFlags` is passed down to populate the dropdowns. Action editors set `key` from the selected flag id and `value` as a boolean.
  - Inventory editor wiring: Use `InventoryEditor` with props `{ items, onItemsChange, isOpen, onClose }`.
  - Achievements editor: `AchievementsEditor` provides CRUD for `adventure.achievements` and lets you edit unlock conditions using the common `ConditionBuilder`. It opens from the Data tab in the sidebar.
  - Stats editor: `StatsEditor` is a dedicated modal for managing `adventure.stats` (CRUD, search). Open it from the Data tab. Wire with props `{ stats, onStatsChange, isOpen, onClose }`.

## External integration points
- React and ReactDOM from esm.sh, Tailwind from CDN. No build tooling—keep code ES module compatible.
- Saving/loading uses browser `localStorage` via `EditorSessionStorage`. Cross-game export/import helpers live under `src/engine` and `src/utils`.

## Gotchas
- No bundler: avoid node-style imports of packages; only use URLs (esm.sh) or local relative paths.
- The canvas graph caches connection versions; after changing choices or positions, call the provided update utilities to avoid stale edges.
- Some tests rely on browser globals; see `test/setupBrowserEnv.js` for polyfills when needed.
- Choice evaluation and flags: the engine invalidates caches when stats/flags change and the UI disables any choice where `evaluation.isSelectable === false` (not only when `state === 'LOCKED'`). If you add new actions that affect flags/stats, ensure they trigger cache clears and re-evaluation like current `executeActions()`.

### Usage limits for choices
- Choices support `oneTime`, `maxUses`, and `cooldown` (milliseconds). Configure these in the Advanced Choice dialog (Basic tab → Usage Limits).
- The runtime `ChoiceEvaluator` enforces limits using `choiceHistory`. When a choice has no uses remaining or is on cooldown, it is returned with `state: 'LOCKED'`, `isSelectable: false`, and an explanatory reason (plus `cooldownRemainingMs` when relevant).
- New choices default to `oneTime: false`, `maxUses: 0` (unlimited), `cooldown: 0`.

## Maintenance rule (important)
- After any substantive code edit, feature addition, or change to workflows, update this file (`.github/copilot-instructions.md`) to keep agent guidance accurate. Keep it concise and focused on how-to for THIS repo (not generic tips).

### Automation that enforces this
- Local pre-commit hook: run `npm run setup:hooks` once to enable. Commits that change code under `src/`, `components/`, `engine/`, `editor/`, `hooks/`, `services/`, `types/`, `utils/`, `tests/`, `test/`, or root files like `index.html`, `package.json`, `validation_test.js` will be blocked unless this file is staged too.
- CI guard: GitHub Action `.github/workflows/require-copilot-instructions.yml` fails pull requests that modify code without updating this file. If your PR fails with this message, include a brief update here describing what changed and how to run/test.

## Repository structure (quick map)
- Root
  - `index.html` — loads Tailwind via CDN and boots `src/main.js`
  - `package.json` — ESM module, `npm test` runs Node tests under `tests/`
  - `validation_test.js` — browser-oriented validation demo (open in browser)
  - `.github/copilot-instructions.md` — this guide (keep updated)
- `src/`
  - `main.js` — mounts the app (React via esm.sh)
  - `App.js` — toggles Editor/Player, passes adventure to `GameScreen`
  - `components/`
    - `common/` — shared UI (Button, ConditionBuilder, ErrorBoundary, LazyAdventureLoader)
    - `editor/`
      - `core/` — canvas, toolbar, sidebar, context menu
      - `dialogs/` — Scene/Choice editors, ActionHistory, FlagEditor, etc.
      - `panels/` — SearchPanel and other side panels
  - `InventoryEditor.js`, `AdvancedChoiceDialog.js`, `AchievementsEditor.js`, `StatsEditor.js`, `EditorScreen.js` (editor orchestrator)
    - `player/` — Game runtime UI (GameScreen, SceneDisplay, ChoiceList, InventoryDisplay, StatsPanel, SaveLoadMenu)
  - `contexts/` — `GameContext.js` (state and providers)
  - `editor/` — Editor orchestration (CommandSystem, EditorEngine, ExportSystem, NodeManager, ValidationEngine)
  - `engine/` — Runtime engine (StoryEngine, ChoiceEvaluator, ConditionParser, StatsManager, InventoryManager, Save systems, ExportableDataManager)
    - `__tests__/` — engine tests
  - `hooks/` — `useGameState`, `useLazyAdventure`
  - `services/` — CommandHistory, ValidationService (and backups)
  - `types/` — Adventure, GameState, SaveData documentation/types
  - `utils/` — helpers (compatibilityChecker, exportHelpers, validation, etc.)
  - `adventures/` — sample adventure(s)
- `tests/` — Node test entry points (e.g., `storyEngine.validateCurrentState.test.js`)
