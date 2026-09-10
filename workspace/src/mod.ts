import type { Editor, TLUiIconJsx } from 'tldraw'
import type { BoardScriptConfig } from 'tldraw-offline/script-context'

// A mod is a file in src/mods/. Its default export is the same function the app runs for config.js:
// it gets { config } before the editor is created and adds shapes, tools, or UI to it.
// build.mjs writes src/mods/index.ts from whatever is in the folder; config.tsx runs each one in filename order.
export type ModConfig = BoardScriptConfig

// Optional named exports.
// `tool`: a toolbar button that switches to the tool with this id (one the mod added to config.tools).
export interface ModTool { id: string; label: string; icon: TLUiIconJsx; kbd?: string }
// `commands`: right-click menu entries.
export interface ModCommand { id: string; label: string; icon?: TLUiIconJsx; readonlyOk?: boolean; run(editor: Editor): void }

export interface Mod { default: ModConfig; tool?: ModTool; commands?: ModCommand[] }
