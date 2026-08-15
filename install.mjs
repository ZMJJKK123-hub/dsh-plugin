#!/usr/bin/env node
/**
 * One-command installer for the standalone dsh plugins.
 *
 *   node install.mjs <path-to-dsh-source-tree>
 *
 * Wires the three @dsh-custom packages into a source-run dsh checkout:
 *   1. adds the workspace references to the checkout's pnpm-workspace.yaml
 *   2. adds the @dsh-custom devDependencies to the checkout's root package.json
 *   3. rewrites this folder's tsconfig/tsdown paths to point at that checkout
 *   4. writes the profile patch (~/.dsh/profiles/web/cordis.patch.yml) when
 *      it is still the default empty template; otherwise prints what to add
 *
 * Idempotent: re-running after a partial setup completes or no-ops.
 * After install: run `pnpm install` in the checkout, restart dsh web, and
 * refresh the browser.
 */
import { existsSync, readFileSync, writeFileSync } from 'node:fs'
import { homedir } from 'node:os'
import { dirname, join, relative, resolve, sep } from 'node:path'
import { fileURLToPath } from 'node:url'

const PLUGINS_ROOT = resolve(dirname(fileURLToPath(import.meta.url)))

const DEV_DEPS = {
  '@dsh-custom/dsh-change-monitor': 'workspace:*',
  '@dsh-custom/dsh-client-ui-change-monitor': 'workspace:*',
  '@dsh-custom/dsh-client-ui-voice-input': 'workspace:*',
}

const PROFILE_PATCH = `# Standalone plugins from ${PLUGINS_ROOT.split(sep).join('/')} (@dsh-custom/*): the web-app
# bundle rows still name the in-tree @deepseek-ai packages; disable them and
# mount the standalone copies instead.
- id: change-monitor
  disabled: true

- id: ui-change-monitor
  disabled: true

- id: ui-voice-input
  disabled: true

- insert:
    - id: change-monitor-standalone
      name: '@dsh-custom/dsh-change-monitor'

    - id: ui-change-monitor-standalone
      name: '@dsh-custom/dsh-client-ui-change-monitor'

    - id: ui-voice-input-standalone
      name: '@dsh-custom/dsh-client-ui-voice-input'
`

function fail(message) {
  console.error(`install: ${message}`)
  process.exit(1)
}

function slash(path) {
  return path.split(sep).join('/')
}

function relFrom(fromDir, toPath) {
  return slash(relative(fromDir, toPath)) || '.'
}

/** Compute the plugins-root-relative workspace glob lines for a checkout. */
function workspaceLines(srcRoot) {
  const base = relFrom(srcRoot, PLUGINS_ROOT)
  return [
    `- ${base}/packages/change-monitor`,
    `- ${base}/packages/client/*`,
  ]
}

/** Ensure the checkout's pnpm-workspace.yaml lists the plugin packages. */
function wireWorkspace(srcRoot) {
  const file = join(srcRoot, 'pnpm-workspace.yaml')
  if (!existsSync(file)) fail(`pnpm-workspace.yaml not found in ${srcRoot}`)
  let text = readFileSync(file, 'utf8')
  const lines = workspaceLines(srcRoot)
  if (lines.every(line => text.includes(line))) {
    console.log('  pnpm-workspace.yaml: already wired')
    return
  }
  // Insert after the first `packages:` block start (keep comments intact).
  const marker = 'packages:'
  const index = text.indexOf(marker)
  if (index === -1) fail('pnpm-workspace.yaml has no packages: list')
  const insertAt = index + marker.length
  text = `${text.slice(0, insertAt)}\n${lines.join('\n')}${text.slice(insertAt)}`
  writeFileSync(file, text, 'utf8')
  console.log(`  pnpm-workspace.yaml: added ${lines.length} reference(s)`)
}

/** Ensure the checkout's root package.json devDependencies pin the plugins. */
function wireDevDeps(srcRoot) {
  const file = join(srcRoot, 'package.json')
  if (!existsSync(file)) fail(`package.json not found in ${srcRoot}`)
  const manifest = JSON.parse(readFileSync(file, 'utf8'))
  const deps = manifest.devDependencies ?? {}
  const missing = Object.keys(DEV_DEPS).filter(name => deps[name] === undefined)
  if (missing.length === 0) {
    console.log('  package.json: devDependencies already present')
    return
  }
  for (const name of missing) deps[name] = DEV_DEPS[name]
  manifest.devDependencies = deps
  writeFileSync(file, `${JSON.stringify(manifest, null, 2)}\n`, 'utf8')
  console.log(`  package.json: added ${missing.join(', ')}`)
}

/** Recompute the checkout-relative paths in the plugin tsconfig files. */
function wireTsconfigs(srcRoot) {
  const base = slash(join(srcRoot, 'tsconfig.base.json'))
  const baseClient = slash(join(srcRoot, 'tsconfig.base.client.json'))
  const vendorCordis = slash(join(srcRoot, 'vendor/cordis'))
  const vendorSchemastery = slash(join(srcRoot, 'vendor/schemastery'))
  const invariants = slash(join(srcRoot, 'packages/runtime-diagnostics/invariants'))
  const hostRefs = [
    'vendor/cordis', 'vendor/schemastery',
    'packages/util/home-paths', 'packages/core/session',
    'packages/typert/protocol', 'packages/runtime-diagnostics/invariants',
  ]
  const clientRefs = [
    'vendor/cordis',
    'packages/client/locale', 'packages/client/runtime',
    'packages/client/ui-conversation', 'packages/client/ui-primitives',
    'packages/client/ui-slots', 'packages/typert/protocol',
    'packages/runtime-diagnostics/invariants',
  ]
  const specs = [
    {
      dir: join(PLUGINS_ROOT, 'packages/change-monitor'),
      extends: base,
      typeRoots: slash(join(srcRoot, 'node_modules/@types')),
      refs: hostRefs,
    },
    {
      dir: join(PLUGINS_ROOT, 'packages/client/ui-change-monitor'),
      extends: baseClient,
      refs: [...clientRefs, '!standalone-change-monitor'],
    },
    {
      dir: join(PLUGINS_ROOT, 'packages/client/ui-voice-input'),
      extends: baseClient,
      refs: clientRefs,
    },
  ]
  for (const spec of specs) {
    const file = join(spec.dir, 'tsconfig.json')
    const references = spec.refs.map((ref) => {
      if (ref === '!standalone-change-monitor') {
        return slash(relative(spec.dir, join(PLUGINS_ROOT, 'packages/change-monitor')))
      }
      return relFrom(spec.dir, join(srcRoot, ref))
    })
    const config = {
      extends: relFrom(spec.dir, srcRoot) + (spec.extends.endsWith('tsconfig.base.json') ? '/tsconfig.base.json' : '/tsconfig.base.client.json'),
      compilerOptions: {
        rootDir: 'src',
        outDir: 'lib/types',
        ...(spec.typeRoots === undefined ? {} : { typeRoots: [relFrom(spec.dir, join(srcRoot, 'node_modules/@types'))] }),
      },
      include: ['src'],
      references: references.map(path => ({ path })),
    }
    const text = `${JSON.stringify(config, null, 2)}\n`
    if (readFileSync(file, 'utf8') === text) {
      console.log(`  ${file}: paths already correct`)
      continue
    }
    writeFileSync(file, text, 'utf8')
    console.log(`  ${file}: rewrote paths`)
  }
  // tsdown configs import the checkout's shared client preset.
  for (const pkg of ['packages/client/ui-change-monitor', 'packages/client/ui-voice-input']) {
    const file = join(PLUGINS_ROOT, pkg, 'tsdown.config.ts')
    const preset = slash(join(srcRoot, 'packages/client/tsdown.client.ts'))
    const id = pkg === 'packages/client/ui-change-monitor'
      ? '@dsh-custom/dsh-client-ui-change-monitor'
      : '@dsh-custom/dsh-client-ui-voice-input'
    const entries = pkg === 'packages/client/ui-change-monitor'
      ? "['lib/types/index.js', 'lib/types/invariant.js']"
      : "['lib/types/index.js', 'lib/types/invariant.js']"
    const text = `import { clientBundle } from '${relFrom(dirname(file), preset)}'\n\nexport default clientBundle('${id}', ${entries})\n`
    if (readFileSync(file, 'utf8') === text) {
      console.log(`  ${file}: already correct`)
      continue
    }
    writeFileSync(file, text, 'utf8')
    console.log(`  ${file}: rewrote preset import`)
  }
}

/** Write the profile patch when it is still the default empty template. */
function wireProfilePatch() {
  const home = process.env.DSH_HOME !== undefined && process.env.DSH_HOME !== ''
    ? process.env.DSH_HOME
    : join(homedir(), '.dsh')
  const file = join(home, 'profiles', 'web', 'cordis.patch.yml')
  if (!existsSync(file)) {
    console.log(`  profile patch: ${file} missing — create it with the contents from cordis.patch.yml in this folder`)
    return
  }
  const text = readFileSync(file, 'utf8')
  if (text.includes('change-monitor-standalone')) {
    console.log('  profile patch: already registered')
    return
  }
  const trimmed = text.trim()
  const isTemplate = trimmed === '[]' || (trimmed.startsWith('#') && trimmed.endsWith('[]'))
  if (isTemplate) {
    writeFileSync(file, PROFILE_PATCH, 'utf8')
    console.log(`  profile patch: wrote ${file}`)
  } else {
    console.log(`  profile patch: ${file} already customized — add the @dsh-custom rows manually (see cordis.patch.yml in this folder)`)
  }
}

// ── main ────────────────────────────────────────────────────────────────────

const srcRoot = resolve(process.argv[2] ?? '')
if (srcRoot === '' || !existsSync(join(srcRoot, 'package.json')) || !existsSync(join(srcRoot, 'pnpm-workspace.yaml'))) {
  fail(`usage: node install.mjs <path-to-dsh-source-tree> (got ${JSON.stringify(process.argv[2])})`)
}
console.log(`Installing plugins from ${PLUGINS_ROOT} into ${srcRoot}`)
wireWorkspace(srcRoot)
wireDevDeps(srcRoot)
wireTsconfigs(srcRoot)
wireProfilePatch()
console.log('\nNext:')
console.log(`  cd ${srcRoot}`)
console.log('  pnpm install')
console.log('  restart dsh web, then refresh the browser')
