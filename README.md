# Standalone DeepSeek Harness plugins — changes monitor + voice input

Three packages extracted from the dsh source tree, published under the
`@dsh-custom/*` scope (the `@deepseek-ai/*` originals stay in the checkout,
so both can coexist). No dsh source is included in this folder.

- `packages/change-monitor`            `@dsh-custom/dsh-change-monitor`           (host service)
- `packages/client/ui-change-monitor`  `@dsh-custom/dsh-client-ui-change-monitor` (browser changes panel)
- `packages/client/ui-voice-input`     `@dsh-custom/dsh-client-ui-voice-input`    (composer mic)

## Install (one command)

Clone this repo anywhere, then run the installer with the path of the dsh
checkout you run `dsh web` from:

```sh
git clone https://github.com/ZMJJKK123-hub/dsh-plugin.git
cd dsh-plugin
node install.mjs <path-to-your-dsh-source-tree>
```

The installer wires everything: workspace references, root devDependencies,
this folder's tsconfig/tsdown paths (pointed at your checkout), and the
profile patch. Then finish with:

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
