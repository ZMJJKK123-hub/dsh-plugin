#!/usr/bin/env node
/**
 * One-command installer for the standalone dsh plugins.
 *
 *   node install.mjs <path-to-dsh-source-tree>
 *
 * Wires the @dsh-custom packages into a source-run dsh checkout:
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
import { spawnSync } from 'node:child_process'
import { copyFileSync, existsSync, mkdirSync, readdirSync, readFileSync, statSync, writeFileSync } from 'node:fs'
import { homedir } from 'node:os'
import { dirname, join, relative, resolve, sep } from 'node:path'
import { fileURLToPath } from 'node:url'

const PLUGINS_ROOT = resolve(dirname(fileURLToPath(import.meta.url)))

const DEV_DEPS = {
  '@dsh-custom/dsh-change-monitor': 'workspace:*',
  '@dsh-custom/dsh-client-ui-change-monitor': 'workspace:*',
  '@dsh-custom/dsh-client-ui-voice-input': 'workspace:*',
  '@dsh-custom/dsh-client-ui-background': 'workspace:*',
  '@dsh-custom/dsh-client-ui-turn-sounds': 'workspace:*',
  '@dsh-custom/dsh-tool-browser': 'workspace:*',
  '@dsh-custom/dsh-tool-screenshot': 'workspace:*',
  '@dsh-custom/dsh-tool-input': 'workspace:*',
}

const PROFILE_PATCH = `# Standalone plugins from ${PLUGINS_ROOT.split(sep).join('/')} (@dsh-custom/*): the web-app
# bundle rows still name the in-tree @deepseek-ai packages; disable them and
# mount the standalone copies instead. ui-deliverables is disabled because
# the changes panel claims the same turn-tail slot (single-winner chain);
# harmless when the checkout already disables it in its bundle.
# Resolution: the loader resolves bare rows from THIS directory upward, so
# the packages must be reachable from the profile — the healed
# ~/.dsh/profiles/node_modules mirrors the apps/cli dependency closure, and
# install.mjs adds the @dsh-custom entries to apps/cli/package.json for
# exactly that reason (root devDependencies are invisible to the healer).
- id: change-monitor
  disabled: true

- id: ui-change-monitor
  disabled: true

- id: ui-voice-input
  disabled: true

- id: ui-background
  disabled: true

- id: ui-deliverables
  disabled: true

- insert:
    - id: change-monitor-standalone
      name: '@dsh-custom/dsh-change-monitor'

    - id: ui-change-monitor-standalone
      name: '@dsh-custom/dsh-client-ui-change-monitor'

    - id: ui-voice-input-standalone
      name: '@dsh-custom/dsh-client-ui-voice-input'

    - id: ui-background-standalone
      name: '@dsh-custom/dsh-client-ui-background'

    - id: ui-turn-sounds-standalone
      name: '@dsh-custom/dsh-client-ui-turn-sounds'

    - id: tool-browser-standalone
      name: '@dsh-custom/dsh-tool-browser'

    - id: tool-screenshot-standalone
      name: '@dsh-custom/dsh-tool-screenshot'

    - id: tool-input-standalone
      name: '@dsh-custom/dsh-tool-input'
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
    `- ${base}/packages/tool-browser`,
    `- ${base}/packages/tool-screenshot`,
    `- ${base}/packages/tool-input`,
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

/**
 * Ensure apps/cli/package.json depends on the plugins. This is the load
 * path that actually matters: the dsh loader resolves bare plugin rows from
 * the profile directory, and the only fallback there is the healed
 * ~/.dsh/profiles/node_modules, which mirrors the apps/cli dependency
 * closure (dependencies + peerDependencies only — root devDependencies are
 * invisible to it). Without these entries a fresh checkout boots to
 * ERR_MODULE_NOT_FOUND for every @dsh-custom row.
 */
function wireCliDeps(srcRoot) {
  const file = join(srcRoot, 'apps', 'cli', 'package.json')
  if (!existsSync(file)) {
    console.log('  apps/cli/package.json: not found — skipping (non-standard layout)')
    return
  }
  const manifest = JSON.parse(readFileSync(file, 'utf8'))
  const deps = manifest.dependencies ?? {}
  const missing = Object.keys(DEV_DEPS).filter(name => deps[name] === undefined)
  if (missing.length === 0) {
    console.log('  apps/cli/package.json: dependencies already present')
    return
  }
  for (const name of missing) deps[name] = DEV_DEPS[name]
  manifest.dependencies = deps
  writeFileSync(file, `${JSON.stringify(manifest, null, 2)}\n`, 'utf8')
  console.log(`  apps/cli/package.json: added ${missing.join(', ')}`)
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
  const backgroundRefs = [
    'vendor/cordis',
    'packages/client/locale', 'packages/client/runtime',
    'packages/client/ui-settings', 'packages/client/ui-slots',
    'packages/runtime-diagnostics/invariants',
  ]
  const turnSoundsRefs = [
    'vendor/cordis',
    'packages/client/locale', 'packages/client/runtime',
    'packages/client/ui-settings', 'packages/client/ui-slots',
    'packages/runtime-diagnostics/invariants',
  ]
  const browserRefs = [
    'vendor/cordis',
    'packages/core/tools', 'packages/core/agent',
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
      dir: join(PLUGINS_ROOT, 'packages/tool-screenshot'),
      extends: base,
      typeRoots: slash(join(srcRoot, 'node_modules/@types')),
      refs: [
        'vendor/cordis', 'packages/core/tools', 'packages/fs/fs',
        'packages/shell/shell', 'packages/runtime-diagnostics/invariants',
      ],
    },
    {
      dir: join(PLUGINS_ROOT, 'packages/tool-browser'),
      extends: base,
      typeRoots: slash(join(srcRoot, 'node_modules/@types')),
      refs: browserRefs,
    },
    {
      dir: join(PLUGINS_ROOT, 'packages/tool-input'),
      extends: base,
      typeRoots: slash(join(srcRoot, 'node_modules/@types')),
      refs: [
        'vendor/cordis', 'packages/core/tools',
        'packages/shell/shell', 'packages/runtime-diagnostics/invariants',
      ],
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
    {
      dir: join(PLUGINS_ROOT, 'packages/client/ui-background'),
      extends: baseClient,
      refs: backgroundRefs,
    },
    {
      dir: join(PLUGINS_ROOT, 'packages/client/ui-turn-sounds'),
      extends: baseClient,
      refs: turnSoundsRefs,
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
  for (const pkg of ['packages/client/ui-change-monitor', 'packages/client/ui-voice-input', 'packages/client/ui-background', 'packages/client/ui-turn-sounds']) {
    const file = join(PLUGINS_ROOT, pkg, 'tsdown.config.ts')
    const preset = slash(join(srcRoot, 'packages/client/tsdown.client.ts'))
    const id = {
      'packages/client/ui-change-monitor': '@dsh-custom/dsh-client-ui-change-monitor',
      'packages/client/ui-voice-input': '@dsh-custom/dsh-client-ui-voice-input',
      'packages/client/ui-background': '@dsh-custom/dsh-client-ui-background',
      'packages/client/ui-turn-sounds': '@dsh-custom/dsh-client-ui-turn-sounds',
    }[pkg]
    const text = `import { clientBundle } from '${relFrom(dirname(file), preset)}'\n\nexport default clientBundle('${id}', ['lib/types/index.js', 'lib/types/invariant.js'])\n`
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
    // The profile may not exist yet (fresh checkout, never booted). Create
    // the patch so the first boot picks the plugins up right away.
    mkdirSync(dirname(file), { recursive: true })
    writeFileSync(file, PROFILE_PATCH, 'utf8')
    console.log(`  profile patch: created ${file}`)
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

/**
 * Wire the vendored GLM-4V vision MCP server into the web profile patch.
 * The row points at this folder's third-party copy so a fresh machine only
 * needs the checkout, this folder, and one local `install.ps1`/`install.sh`
 * run to create the venv and `.env`.
 */
function wireVisionMcp() {
  const home = process.env.DSH_HOME !== undefined && process.env.DSH_HOME !== ''
    ? process.env.DSH_HOME
    : join(homedir(), '.dsh')
  const file = join(home, 'profiles', 'web', 'cordis.patch.yml')
  const mcpDir = join(PLUGINS_ROOT, 'third-party', 'glm4v-vision-mcp')
  const serverPy = join(mcpDir, 'server', 'glm4v_mcp_server.py')
  if (!existsSync(serverPy)) {
    console.log('  vision-mcp: glm4v-vision-mcp not vendored; skipping')
    return
  }
  const python = process.platform === 'win32'
    ? join(mcpDir, '.venv', 'Scripts', 'python.exe')
    : join(mcpDir, '.venv', 'bin', 'python')
  if (!existsSync(python)) {
    console.log(`  vision-mcp: venv missing — run install.ps1/install.sh once in ${mcpDir}`)
  }
  if (!existsSync(file)) {
    console.log(`  vision-mcp: ${file} missing — start dsh web once, then re-run`)
    return
  }
  const text = readFileSync(file, 'utf8')
  if (text.includes('mcp-glm4v')) {
    console.log('  vision-mcp: profile patch already registered')
    return
  }
  const entry = `

# GLM-4.6V 视觉理解 MCP → DSH 原生工具（mcp__glm4v__*）
- insert:
    - id: mcp-glm4v
      name: '@deepseek-ai/dsh-mcp-client'
      config:
        serverName: glm4v
        transport: stdio
        command: '${slash(python)}'
        args:
          - '${slash(serverPy)}'
        toolCallTimeoutMs: 300000
        failOnStartupError: false
`
  writeFileSync(file, `${text}${entry}`, 'utf8')
  console.log(`  vision-mcp: added mcp-glm4v row to ${file}`)
}

/**
 * Wire the vendored third-party plugins (third-party/* under this folder):
 * every package declaring `dsh.bundle` becomes a profile dependency
 * (link:) plus a profile-bundle-layer entry, the profile is installed, and
 * the router-standard agent preset is copied into ~/.dsh/.agent-presets.
 * This keeps the whole stack self-contained — a fresh machine only needs
 * the checkout and this folder, no upstream git pulls.
 */
function wireThirdParty() {
  const home = process.env.DSH_HOME !== undefined && process.env.DSH_HOME !== ''
    ? process.env.DSH_HOME
    : join(homedir(), '.dsh')
  const profileDir = join(home, 'profiles', 'web')
  const manifestFile = join(profileDir, 'package.json')
  const thirdParty = join(PLUGINS_ROOT, 'third-party')
  if (!existsSync(thirdParty)) {
    console.log('  third-party: none found')
    return
  }
  if (!existsSync(manifestFile)) {
    console.log(`  third-party: ${manifestFile} missing — start dsh web once to initialize the profile, then re-run`)
    return
  }

  const bundles = []
  for (const entry of readdirSync(thirdParty)) {
    if (entry === 'router-standard') continue // preset, not a bundle
    const pkgFile = join(thirdParty, entry, 'package.json')
    if (!existsSync(pkgFile)) continue
    const manifest = JSON.parse(readFileSync(pkgFile, 'utf8'))
    if (manifest.dsh?.bundle?.patch !== undefined) {
      bundles.push({ name: manifest.name, dir: join(thirdParty, entry) })
    }
  }
  if (bundles.length === 0) {
    console.log('  third-party: no bundle packages found')
    return
  }

  const manifest = JSON.parse(readFileSync(manifestFile, 'utf8'))
  const deps = manifest.dependencies ?? {}
  const list = manifest.dsh?.profile?.bundles ?? []
  let changed = false
  for (const bundle of bundles) {
    const spec = `link:${slash(bundle.dir)}`
    if (deps[bundle.name] !== spec) { deps[bundle.name] = spec; changed = true }
    if (!list.includes(bundle.name)) { list.push(bundle.name); changed = true }
  }
  if (changed) {
    manifest.dependencies = deps
    manifest.dsh = { ...manifest.dsh, profile: { ...manifest.dsh?.profile, bundles: list } }
    writeFileSync(manifestFile, `${JSON.stringify(manifest, null, 2)}\n`, 'utf8')
    console.log(`  third-party: wired ${bundles.map(bundle => bundle.name).join(', ')} into the profile`)
    const result = spawnSync('pnpm', ['install'], { cwd: profileDir, stdio: 'inherit', shell: process.platform === 'win32' })
    if (result.status !== 0) {
      console.log('  third-party: pnpm install in the profile failed — re-run after fixing')
    }
  } else {
    console.log('  third-party: already wired')
  }

  // Router-standard agent preset (idempotent copy).
  const presetSrc = join(thirdParty, 'router-standard')
  if (existsSync(presetSrc)) {
    const target = join(home, '.agent-presets', 'router-standard')
    mkdirSync(target, { recursive: true })
    copyTree(presetSrc, target)
    console.log('  third-party: router-standard preset copied')
  }
}

/** Recursively copy one directory tree into another (idempotent overwrite). */
function copyTree(source, target) {
  for (const entry of readdirSync(source)) {
    const from = join(source, entry)
    const to = join(target, entry)
    if (statSync(from).isDirectory()) {
      mkdirSync(to, { recursive: true })
      copyTree(from, to)
    } else {
      copyFileSync(from, to)
    }
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
wireCliDeps(srcRoot)
wireTsconfigs(srcRoot)
wireProfilePatch()
wireThirdParty()
wireVisionMcp()
console.log('\nNext:')
console.log(`  cd ${srcRoot}`)
console.log('  pnpm install')
console.log('  restart dsh web, then refresh the browser')
