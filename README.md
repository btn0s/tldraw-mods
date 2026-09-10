# tldraw-mods

Mods for [tldraw offline](https://github.com/tldraw/tldraw-offline): custom shapes, tools, and UI installed into a document with one command. Browse at [tldraw-mods.pages.dev](https://tldraw-mods.pages.dev).

## How to use

You need the [tldraw offline](https://offline.tldraw.com) desktop app and Node 20+. Mods are per document: each `.tldraw` file carries its own script, and a workspace folder is where that script is assembled.

**1. Make a folder and put your document in it.** The folder is the workspace; the document lives inside so the CLI knows which one to update.

```sh
mkdir my-canvas && cd my-canvas
# File → New in tldraw offline, then File → Save into this folder as my-canvas.tldraw
```

**2. Set up the workspace.** One time per folder. Writes the build, a `src/` with the shell and design tokens, and installs dependencies.

```sh
npx tldraw-mods init
```

**3. Add mods.** With the document open in the app, `add` downloads the mod into `src/mods/`, bundles, loads it into the open document, and saves. The new tool appears at the end of the toolbar.

```sh
npx tldraw-mods add landmark
npx tldraw-mods add browser
```

**4. Later.** `npx tldraw-mods list` shows what is available; `remove browser` deletes it and reloads; `apply` reloads after you edit anything in `src/`. The script is saved inside the `.tldraw` file, so the document keeps its mods when you open it anywhere, with or without this folder.

If the document is somewhere else, pass it: `npx tldraw-mods add landmark --doc=/path/to/file.tldraw`. Any shadcn GitHub registry works as a source: `npx tldraw-mods add owner/repo/item`.

Only install mods from people you trust. A document script runs with the app's permissions whenever the file is opened.

## What is in this repo

- **`registry.json`** — a [shadcn GitHub registry](https://ui.shadcn.com/docs/registry/github). The catalog. First-party mods are items with files; third-party mods are pointer items whose `registryDependencies` reference the author's own registry. CI validates every item on push and nightly.
- **`cli/`** — `tldraw-mods`, a thin convention layer over the shadcn CLI (pinned). `init` lays down a workspace, `add`/`remove` manage `src/mods/`, `apply` loads the bundle into the open document through the app's local API. It never edits source files.
- **`workspace/`** — the document-script workspace `init` ships, and where first-party mods are developed. `build.mjs` generates `src/mods/index.ts` from the directory listing; `src/config.tsx` runs every mod. Registration is file placement.

## The protocol

A mod is `src/mods/<name>.tsx` whose default export is the app's own config-script function (`BoardScriptConfig` from `tldraw-offline/script-context`). Optional named exports `tool` and `commands` put it in the toolbar and context menu. See `workspace/src/mod.ts`.

To publish one, add a `registry.json` to your repo root with files targeting `~/src/mods/<name>.tsx`, never list `tldraw`/`react` as npm dependencies, and validate with `npx shadcn@latest registry validate`. Anyone can then `npx tldraw-mods add you/repo/name`. Open a PR here adding a pointer item to list it on the site. Full walkthrough: [tldraw-mods.pages.dev/protocol](https://tldraw-mods.pages.dev/protocol/).

## Develop

```sh
cd workspace && npm install
npm run typecheck        # tsc against the installed app's SDK types
npm run apply            # into any open document from this directory
cd ../site && node build.mjs && wrangler pages deploy dist --project-name tldraw-mods
```

Not affiliated with tldraw. Document scripts run inside your documents; review before installing.
