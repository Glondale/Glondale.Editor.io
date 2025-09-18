# Agents Guide for Glondale.Editor.io

## Project Snapshot
- **Title:** Glondale.Editor.io — browser-based interactive fiction editor/player.
- **Runtime:** Pure ES modules served from `index.html`; React 18 pulled from `https://esm.sh` at runtime (no bundler).
- **Language:** JavaScript (ESM). Tests use Node’s built-in test runner.
- **Entry Point:** `src/main.js` mounts `<App />` into `#root` (see `index.html`).

## Quick Start
- Install hooks (optional, once): `npm run setup:hooks`
- Run unit tests: `npm test`
- Develop: serve the repo root with any static server (e.g. `npx serve .`) and open `index.html`. Ensure network access for esm.sh modules.

## Repository Layout
```
root
├── index.html              # Minimal host page that loads src/main.js
├── src/
│   ├── App.js              # Chooses between game player and editor UI
│   ├── engine/             # Core story runtime (StoryEngine, StatsManager, etc.)
│   ├── components/
│   │   ├── editor/         # Editor UI (EditorScreen, dialogs, canvas, toolbar)
│   │   ├── player/         # Player UI (GameScreen, ChoiceList, etc.)
│   │   └── common/         # Shared widgets (ErrorBoundary, ConditionBuilder)
│   ├── commands/           # Command pattern wrappers used by the editor
│   ├── contexts/           # React context providers (GameContext)
│   ├── hooks/              # Custom hooks (useGameState, etc.)
│   ├── services/           # ValidationService, CommandHistory, storage helpers
│   ├── utils/              # Misc utilities (sanitizeHtml, error logger, etc.)
│   └── types/              # Adventure type definitions
├── tests/                  # Node test suites (Bun-style naming but run via node)
├── validation_test.js      # Legacy validation harness
├── package.json            # Only `npm test` and hook setup scripts
└── .githooks/              # Pre-commit hook enforcing doc updates
```

## Build & Test Commands
| Purpose | Command |
|---------|---------|
| Run unit tests | `npm test` |
| Install git hooks | `npm run setup:hooks` |
| Serve locally (example) | `npx serve .` then open `http://localhost:3000/index.html` |

> **Note:** Because React is loaded from `esm.sh`, a live internet connection is required when serving the app locally.

## Coding Conventions & Tooling
- ES modules everywhere; files end with `.js` and use `import/export`.
- React components use `createElement` (no JSX) with CDN imports.
- Tests live in `tests/` and use Node’s test runner (`node --test`).
- Pre-commit hook requires updating `.github/copilot-instructions.md` whenever source files change; keep that doc synchronized with significant edits.
- Inventory/stat managers are intertwined—remember to keep references synchronized (`StatsManager.setInventoryManager(...)`).
- Logging uses `console.*` plus `utils/errorLogger.js` for structured messages.

## Function Map (Core Runtime)
- **StoryEngine (`src/engine/StoryEngine.js`)**
  - `loadAdventure` → validates, hydrates managers, restores scene state.
  - `navigateToScene` → updates current scene, runs enter/exit actions.
  - `discoverSecretChoices`, `getCurrentChoices`, `makeChoice` (further down) → evaluate choices, update stats/inventory, advance story.
  - `executeActions`, `processChoiceResult`, `reloadAdventure`, `debugState` provide operational hooks for the UI and tests.
- **StatsManager (`src/engine/StatsManager.js`)**
  - Handles stat/flag storage, constraint enforcement, custom stat types.
  - Methods: `setStat`, `addToStat`, `multiplyStat`, `setFlag`, `toggleFlag`, plus inventory passthrough (`addItem`, `hasItem`). Maintains change history and versioning for cache invalidation.
- **InventoryManager (`src/engine/InventoryManager.js`)**
  - CRUD over items, stack limits, definitions; emits `updateStatsIntegration` to keep `total_items` stat in sync; supports consumables via `useItem`.
- **ConditionParser (`src/engine/ConditionParser.js`)**
  - Evaluates conditions across stats, flags, visits, inventory.
- **ChoiceEvaluator (`src/engine/ChoiceEvaluator.js`)**
  - Applies parser + stats to compute choice visibility/lock state; supports secret choices, input prompts, requirements.
- **CrossGameSaveSystem / SaveSystem**
  - Manage persistence and export/import of adventure state.
- **EditorSessionStorage (`src/engine/EditorSessionStorage.js`)**
  - Provides project/session persistence for the editor (localStorage + backups).

## Function Map (Editor Surface)
- **EditorScreen (`src/components/editor/EditorScreen.js`)**
  - Central orchestrator; manages adventure state, command history, dialogs, export routines, validation, search/highlight overlays, choice/scene editing, and ChoiceScript export.
  - Hooks:
    - `handleNode*` functions → wrap command objects for undoable scene graph edits.
    - `handleChoice*`, `handleStat*`, `handleFlag*` → maintain adventure metadata and regenerate connections via command history.
    - `handleExportWithFormat`, `handleImport`, `validateAdventure`, `handleSearch*` → support toolbar actions.
- **EditorToolbar / EditorCanvas / EditorSidebar**
  - Toolbar: dispatches events (`showSearchPanel`, `showActionHistory`), raises exports/validation, displays undo/redo state.
  - Canvas: renders nodes + connections; supports drag, context menu, highlighted states.
  - Sidebar: edits scenes, choices, stats, opens dialogs.
- **Dialogs & Panels**
  - `SceneEditDialog`, `AdvancedChoiceDialog`, `ConditionBuilder`, `FlagEditor`, `InventoryEditor`, `AchievementsEditor`, `StatsEditor`, `SearchPanel`, `ActionHistoryDialog`—each encapsulates editor features and communicate back through handlers defined in `EditorScreen`.
  - `ConditionBuilder` provides template-based condition editing; `ActionHistoryDialog` drives undo/redo timeline via `CommandHistory`.
- **Command Pattern (`src/commands/EditorCommands.js`)**
  - Defines `CreateNodeCommand`, `UpdateNodeCommand`, etc., all calling back into handler refs set up by `EditorScreen`. Undo/redo flows through `CommandHistory` service.

## Function Map (Player/UI Layer)
- **GameContext (`src/contexts/GameContext.js`)**
  - Houses React context with `StoryEngine`, exposes play/choice APIs, and syncs with UI.
- **useGameState (`src/hooks/useGameState.js`)**
  - Drives React state around `StoryEngine` events, available choices, inventory snapshots, achievements.
- **Player components (e.g., `components/player/GameScreen.js`, `ChoiceList.js`, `StatsPanel.js`)**
  - Render active story, handle user choices, display stats/inventory.

## Services & Utilities
- **ValidationService (`src/services/ValidationService.js`)**
  - Pluggable rules + caching; used by both editor startup and StoryEngine.
- **CommandHistory (`src/services/CommandHistory.js`)**
  - Core undo/redo stack with grouping, snapshots, listeners; export singleton `commandHistory` consumed by editor.
- **sanitizeHtml, errorLogger, storage helpers**
  - Located in `src/utils/` and used throughout for consistency.

## Testing Guidance
- Primary tests live in `tests/` and target the engine integration (`storyEngine.validateCurrentState.test.js`, `inventoryConditions.test.mjs`).
- Use `npm test` after modifying engine logic, stats/inventory interactions, or validation rules.
- Consider adding focused tests under `tests/` when expanding editor commands or introducing new runtime behaviour.

## Editing Tips
- Keep React components JSX-free; use `createElement` to match the existing style.
- When adding commands or editor operations, register handler callbacks in `EditorScreen` to integrate with undo/redo.
- Updates touching adventure schema or editor flows should also document behaviour in `.github/copilot-instructions.md` (to satisfy the pre-commit hook) and, ideally, in this Agents guide.
- ChoiceScript export relies on `src/editor/exporters/ChoiceScriptExporter.js`; ensure new choice types or actions degrade gracefully with warnings.

---
Maintaining this file alongside `.github/copilot-instructions.md` will keep the agent aware of project expectations. Update both whenever you add major features, new modules, or change build/test workflows.
