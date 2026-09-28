/**
 * Wire types of the `gitRemote` Typert Remote namespace: every request
 * carries the session id (the host resolves the workspace root from it, so
 * the same panel means the right repository per session) and every answer is
 * a discriminated result — a Remote call never rejects. The view types are
 * this package's own wire contract: mutable arrays and omitted-when-absent
 * optional fields, the lossless-JSON shape a snapshot must carry.
 *
 * @module @dsh-custom/dsh-git-remote
 */
export {};
//# sourceMappingURL=types.js.map