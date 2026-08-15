# Standalone DeepSeek Harness plugins — changes monitor + voice input

Three packages extracted from the dsh source tree, published under the
`@dsh-custom/*` scope (the `@deepseek-ai/*` originals stay in the checkout,
so both can coexist). No dsh source is included in this folder.

- `packages/change-monitor`            `@dsh-custom/dsh-change-monitor`           (host service)
- `packages/client/ui-change-monitor`  `@dsh-custom/dsh-client-ui-change-monitor` (browser changes panel)
- `packages/client/ui-voice-input`     `@dsh-custom/dsh-client-ui-voice-input`    (composer mic)
- `packages/client/ui-background`      `@dsh-custom/dsh-client-ui-background`     (custom chat background)

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

## Alternative: installed dsh (npm/one-file build, not source-run)

```sh
dsh plugin --profile web add <path>/dsh-plugin/packages/change-monitor
dsh plugin --profile web add <path>/dsh-plugin/packages/client/ui-change-monitor
dsh plugin --profile web add <path>/dsh-plugin/packages/client/ui-voice-input
```

and copy the `cordis.patch.yml` rows into `~/.dsh/profiles/web/cordis.patch.yml`.

## Editing and building

Type-check and bundle from the checkout workspace (the tsconfig/tsdown
presets live there):

```sh
pnpm exec tsc -b <path>/dsh-plugin/packages/change-monitor \
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
