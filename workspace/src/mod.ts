import type { Editor, TLUiIconJsx } from 'tldraw'
import type { BoardScriptConfig } from 'tldraw-offline/script-context'

// A mod is a file in src/mods/ whose default export is the app's own config-script function:
// it receives { config } before the editor mounts and pushes shape utils, tools, components, etc.
// The build lists src/mods/ into src/mods/index.ts; config.tsx runs every mod in filename order.
export type ModConfig = BoardScriptConfig

// Optional named exports the shell surfaces in the UI.
// `tool`: a toolbar button that activates the tool with this id (one of the tools the mod pushed).
export interface ModTool { id: string; label: string; icon: TLUiIconJsx; kbd?: string }
// `commands`: context-menu entries run against the editor.
export interface ModCommand { id: string; label: string; icon?: TLUiIconJsx; readonlyOk?: boolean; run(editor: Editor): void }

export interface Mod { default: ModConfig; tool?: ModTool; commands?: ModCommand[] }
