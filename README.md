# Standalone DeepSeek Harness plugins — changes monitor + voice input

These packages are extracted from the dsh source tree, published under the
`@dsh-custom/*` scope (the `@deepseek-ai/*` originals stay in the checkout,
so both can coexist). No dsh source is included in this folder.

- `packages/change-monitor`            `@dsh-custom/dsh-change-monitor`           (host service)
- `packages/client/ui-change-monitor`  `@dsh-custom/dsh-client-ui-change-monitor` (browser changes panel)
- `packages/client/ui-voice-input`     `@dsh-custom/dsh-client-ui-voice-input`    (composer mic)
- `packages/client/ui-background`      `@dsh-custom/dsh-client-ui-background`     (custom chat background)
- `packages/client/ui-turn-sounds`     `@dsh-custom/dsh-client-ui-turn-sounds`    (completion/question sound notifications)
- `packages/tool-browser`              `@dsh-custom/dsh-tool-browser`             (background headless browser automation)
- `packages/tool-screenshot`           `@dsh-custom/dsh-tool-screenshot`          (screenshot tool for the vision loop)
- `packages/tool-input`                `@dsh-custom/dsh-tool-input`               (mouse trajectory/click/drag/scroll + keyboard input)

## Install (one command)

Clone this repo anywhere, then run the installer with the path of the dsh
checkout you run `dsh web` from:

```sh
git clone https://github.com/ZMJJKK123-hub/dsh-plugin.git
cd dsh-plugin
node install.mjs <path-to-your-dsh-source-tree>
```

The installer wires everything: workspace references, root devDependencies,
**apps/cli dependencies** (the loader resolves plugin rows from the profile
directory, whose healed `~/.dsh/profiles/node_modules` mirrors the
apps/cli dependency closure — without this entry a fresh checkout fails to
boot with `ERR_MODULE_NOT_FOUND`), this folder's tsconfig/tsdown paths
(pointed at your checkout), the profile patch, and the **vendored
third-party bundles** under `third-party/` (profile links + bundles layer +
the router-standard agent preset). The whole stack is self-contained: a
fresh machine only needs the checkout and this folder — no upstream git
pulls. Then finish with:

```sh
cd <path-to-your-dsh-source-tree>
pnpm install
```

and restart `dsh web` + refresh the browser. Re-running `install.mjs` is
safe (idempotent); move the checkout or this folder and re-run it.

## Vision MCP (GLM-4V)

This repo vendors `third-party/glm4v-vision-mcp` (free GLM-4.6V-Flash). After
`node install.mjs`, run the vendored installer once to create the venv and
`server/.env` with your `ZHIPU_API_KEY`:

```powershell
cd <path>/dsh-plugin/third-party/glm4v-vision-mcp
Set-ExecutionPolicy -Scope Process Bypass
.\install.ps1
```

Then restart `dsh web` and open a new session. Source-run mode automatically
writes the `mcp-glm4v` row into the web profile patch; installed-dsh mode can
copy the commented row from `cordis.patch.yml`. The session exposes
`mcp__glm4v__analyze_image` / `ocr_image` / `analyze_chart` /
`describe_image` / `check_setup`. Combined with the `screenshot` tool, the
agent can capture its own screen and recognize the image.

## Alternative: installed dsh (npm/one-file build, not source-run)

```sh
dsh plugin --profile web add <path>/dsh-plugin/packages/change-monitor
dsh plugin --profile web add <path>/dsh-plugin/packages/client/ui-change-monitor
dsh plugin --profile web add <path>/dsh-plugin/packages/client/ui-voice-input
dsh plugin --profile web add <path>/dsh-plugin/packages/tool-screenshot
```

and copy the `cordis.patch.yml` rows into `~/.dsh/profiles/web/cordis.patch.yml`.

## Editing and building

Type-check and bundle from the checkout workspace (the tsconfig/tsdown
presets live there):

```sh
pnpm exec tsc -b <path>/dsh-plugin/packages/change-monitor \
  <path>/dsh-plugin/packages/tool-screenshot \
  <path>/dsh-plugin/packages/client/ui-change-monitor \
  <path>/dsh-plugin/packages/client/ui-voice-input
pnpm --filter @dsh-custom/dsh-client-ui-change-monitor bundle
pnpm --filter @dsh-custom/dsh-client-ui-voice-input bundle
```

> **HARD RULE when syncing from the in-tree copy**: rebuild the standalone
> package with ITS OWN tsdown.config.ts (the one install.mjs rewrote, whose
> `clientBundle` id is `@dsh-custom/*`). NEVER copy the in-tree
> `lib/client.js` over, and never build it with the in-tree package's tsdown
> config — the bundle's `__ModuleLoader__.load({ id: ... })` banner would
> register the old `@deepseek-ai/*` id and the browser throws "loaded
> without registering". After any rebuild, verify the banner:
> `Select-String lib/client.js -Pattern 'id: "@dsh-custom'`.

The host service runs from `src` under the source-run dsh (tsx), so host
edits take effect on server restart; browser edits need the bundle rebuilt
and the page refreshed.

## Notes

- The peer dependencies are declared as `*` so the packages resolve against
  whichever dsh build provides them.
- Do NOT add this folder's packages to the checkout's `packages/*/*` glob —
  the `@dsh-custom` scope keeps them out of the in-tree build.
- `lib/` is committed so the plugins work without a build step; the
  installer rewrites the build config paths when the checkout moves.
