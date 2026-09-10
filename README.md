# tldraw-mods

Mods for [tldraw offline](https://github.com/tldraw/tldraw-offline): custom shapes, tools, and UI installed into a document with one command. Browse at [tldraw-mods.pages.dev](https://tldraw-mods.pages.dev).

```sh
npx tldraw-mods init          # once per document-script workspace
npx tldraw-mods add landmark  # installs, bundles, and applies to the open document
```

This repo is three things:

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
