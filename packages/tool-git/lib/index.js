import { isAbsolute, resolve } from "node:path";
import z from "@deepseek-ai/schemastery";
import { defineTool } from "@deepseek-ai/dsh-tools";
//#region lib/types/index.js
/**
* Model-facing git tools over the `ctx.git` capability seam: `git_status`,
* `git_diff`, `git_log`, `git_branch_list`, plus the index/commit/push tools
* `git_stage`, `git_unstage`, `git_commit`, and `git_push`. The tools add no
* execution of their own — they resolve the working directory from the
* session (or an explicit `workdir` argument), call the seam, and render its
* typed results, so any future git provider swap keeps the tool surface
* unchanged.
*
* @module @dsh-custom/dsh-tool-git
*/
/** Cordis plugin name used by loader diagnostics. */
const name = "tool-git";
/** Services required by the git tools. */
const inject = ["tools", "git"];
const Config = z.object({
	maxDiffBytes: z.number().default(131072),
	maxLogCount: z.number().default(30)
});
/**
* Resolve the working directory for one call: an explicit absolute `workdir`
* wins; a relative one resolves against the session workspace; with none, the
* session workspace itself.
*/
function resolveCwd(workdir, exec) {
	const headerCwd = exec.agent?.session.header.cwd;
	const base = headerCwd !== void 0 && headerCwd !== "" ? headerCwd : process.cwd();
	if (workdir === void 0 || workdir.trim() === "") return base;
	if (!isAbsolute(workdir)) return resolve(base, workdir);
	return workdir;
}
/**
* Project one seam result onto its canonical tool JSON: mutable arrays and
* omitted-when-absent optional fields, per the registry's value contract.
*/
function statusToJson(summary) {
	return {
		root: summary.root,
		ahead: summary.ahead,
		behind: summary.behind,
		initial: summary.initial,
		detached: summary.detached,
		...summary.branch !== void 0 ? { branch: summary.branch } : {},
		...summary.upstream !== void 0 ? { upstream: summary.upstream } : {},
		entries: summary.entries.map((entry) => ({
			code: entry.code,
			path: entry.path,
			staged: entry.staged,
			unstaged: entry.unstaged,
			untracked: entry.untracked,
			...entry.originPath !== void 0 ? { originPath: entry.originPath } : {}
		}))
	};
}
function diffToJson(result) {
	return {
		staged: result.staged,
		patch: result.patch,
		truncated: result.truncated,
		...result.path !== void 0 ? { path: result.path } : {}
	};
}
function logToJson(result) {
	return { entries: result.entries.map((entry) => ({ ...entry })) };
}
function branchesToJson(result) {
	return { branches: result.branches.map((branch) => ({
		name: branch.name,
		current: branch.current,
		shortHash: branch.shortHash,
		...branch.upstream !== void 0 ? { upstream: branch.upstream } : {}
	})) };
}
/** One text line per status entry, in git's order. */
function renderStatusEntries(value) {
	if (value.entries.length === 0) return "nothing to commit, working tree clean";
	return value.entries.map((entry) => {
		const origin = entry.originPath !== void 0 ? ` (from ${entry.originPath})` : "";
		return `${entry.code} ${entry.path}${origin}`;
	}).join("\n");
}
/** Project a stage/unstage result onto its canonical tool JSON. */
function stageToJson(result) {
	return { stagedPaths: result.stagedPaths.map((path) => path) };
}
function apply(ctx, config = {}) {
	const resolved = {
		maxDiffBytes: 131072,
		maxLogCount: 30,
		...config
	};
	ctx.tools.register(defineTool({
		name: "git_status",
		description: "Show the working tree status of the session repository: current branch, upstream ahead/behind, and per-file staged/unstaged/untracked entries. Read-only.",
		parameters: { workdir: {
			type: "string",
			description: "Working directory for the repository. Defaults to the session workspace; a relative path is resolved against it."
		} },
		output: {
			schema: {
				type: "object",
				additionalProperties: false,
				properties: {
					root: {
						type: "string",
						required: true
					},
					branch: { type: "string" },
					upstream: { type: "string" },
					ahead: {
						type: "integer",
						required: true
					},
					behind: {
						type: "integer",
						required: true
					},
					initial: {
						type: "boolean",
						required: true
					},
					detached: {
						type: "boolean",
						required: true
					},
					entries: {
						type: "array",
						required: true,
						items: {
							type: "object",
							additionalProperties: false,
							properties: {
								code: {
									type: "string",
									required: true
								},
								path: {
									type: "string",
									required: true
								},
								originPath: { type: "string" },
								staged: {
									type: "boolean",
									required: true
								},
								unstaged: {
									type: "boolean",
									required: true
								},
								untracked: {
									type: "boolean",
									required: true
								}
							}
						}
					}
				}
			},
			render: (_args, value) => [{
				type: "text",
				text: renderStatusEntries(value)
			}]
		},
		async execute(args, exec) {
			return statusToJson(await ctx.git.status(resolveCwd(args.workdir, exec), exec.signal));
		}
	}));
	ctx.tools.register(defineTool({
		name: "git_diff",
		description: "Show a unified diff of the session repository: work tree against the index by default, or the index against HEAD with staged: true. Read-only.",
		parameters: {
			staged: {
				type: "boolean",
				description: "Diff the staged (index) changes against HEAD instead of the work tree against the index."
			},
			path: {
				type: "string",
				description: "Repository-relative path to limit the diff to."
			},
			workdir: {
				type: "string",
				description: "Working directory for the repository. Defaults to the session workspace; a relative path is resolved against it."
			}
		},
		output: {
			schema: {
				type: "object",
				additionalProperties: false,
				properties: {
					staged: {
						type: "boolean",
						required: true
					},
					path: { type: "string" },
					patch: {
						type: "string",
						required: true
					},
					truncated: {
						type: "boolean",
						required: true
					}
				}
			},
			render: (_args, value) => [{
				type: "text",
				text: value.patch === "" ? "(empty diff)" : `\`\`\`diff\n${value.patch.replace(/\n+$/, "")}\n\`\`\``
			}]
		},
		async execute(args, exec) {
			return diffToJson(await ctx.git.diff(resolveCwd(args.workdir, exec), {
				staged: args.staged === true,
				...args.path !== void 0 && args.path !== "" ? { path: args.path } : {},
				maxBytes: resolved.maxDiffBytes
			}, exec.signal));
		}
	}));
	ctx.tools.register(defineTool({
		name: "git_log",
		description: "List commits of the session repository, newest first: short hash, date, author, and subject. Read-only.",
		parameters: {
			max_count: {
				type: "number",
				description: "Maximum commits to return (capped by the host)."
			},
			ref: {
				type: "string",
				description: "Starting revision, e.g. a branch name or HEAD~5. Defaults to HEAD."
			},
			path: {
				type: "string",
				description: "Repository-relative path to limit history to."
			},
			workdir: {
				type: "string",
				description: "Working directory for the repository. Defaults to the session workspace; a relative path is resolved against it."
			}
		},
		output: {
			schema: {
				type: "object",
				additionalProperties: false,
				properties: { entries: {
					type: "array",
					required: true,
					items: {
						type: "object",
						additionalProperties: false,
						properties: {
							hash: {
								type: "string",
								required: true
							},
							shortHash: {
								type: "string",
								required: true
							},
							author: {
								type: "string",
								required: true
							},
							date: {
								type: "string",
								required: true
							},
							subject: {
								type: "string",
								required: true
							}
						}
					}
				} }
			},
			render: (_args, value) => [{
				type: "text",
				text: value.entries.length === 0 ? "(no commits)" : value.entries.map((entry) => `${entry.shortHash} ${entry.date} ${entry.author}\n    ${entry.subject}`).join("\n")
			}]
		},
		async execute(args, exec) {
			return logToJson(await ctx.git.log(resolveCwd(args.workdir, exec), {
				maxCount: Math.min(args.max_count !== void 0 ? Math.floor(args.max_count) : resolved.maxLogCount, resolved.maxLogCount),
				...args.ref !== void 0 && args.ref !== "" ? { ref: args.ref } : {},
				...args.path !== void 0 && args.path !== "" ? { path: args.path } : {}
			}, exec.signal));
		}
	}));
	ctx.tools.register(defineTool({
		name: "git_branch_list",
		description: "List local branches of the session repository with the current branch, its upstream when configured, and each tip hash. Read-only.",
		parameters: { workdir: {
			type: "string",
			description: "Working directory for the repository. Defaults to the session workspace; a relative path is resolved against it."
		} },
		output: {
			schema: {
				type: "object",
				additionalProperties: false,
				properties: { branches: {
					type: "array",
					required: true,
					items: {
						type: "object",
						additionalProperties: false,
						properties: {
							name: {
								type: "string",
								required: true
							},
							current: {
								type: "boolean",
								required: true
							},
							upstream: { type: "string" },
							shortHash: {
								type: "string",
								required: true
							}
						}
					}
				} }
			},
			render: (_args, value) => [{
				type: "text",
				text: value.branches.map((branch) => `${branch.current ? "* " : "  "}${branch.name}${branch.upstream !== void 0 ? ` (${branch.upstream})` : ""} ${branch.shortHash}`).join("\n")
			}]
		},
		async execute(args, exec) {
			return branchesToJson(await ctx.git.branches(resolveCwd(args.workdir, exec), exec.signal));
		}
	}));
	ctx.tools.register(defineTool({
		name: "git_stage",
		description: "Stage work-tree changes (including untracked files) into the git index: explicit repository-relative paths, or the whole work tree with all: true. Requires a write-capable permission preset; a read-only policy denies it.",
		parameters: {
			paths: {
				type: "array",
				items: { type: "string" },
				description: "Repository-relative paths to stage. Required unless all is true."
			},
			all: {
				type: "boolean",
				description: "Stage every change in the work tree, including untracked files."
			},
			workdir: {
				type: "string",
				description: "Working directory for the repository. Defaults to the session workspace; a relative path is resolved against it."
			}
		},
		output: {
			schema: {
				type: "object",
				additionalProperties: false,
				properties: { stagedPaths: {
					type: "array",
					required: true,
					items: { type: "string" }
				} }
			},
			render: (_args, value) => [{
				type: "text",
				text: value.stagedPaths.length === 0 ? "nothing staged" : `staged (${value.stagedPaths.length}):\n${value.stagedPaths.join("\n")}`
			}]
		},
		async execute(args, exec) {
			return stageToJson(await ctx.git.stage(resolveCwd(args.workdir, exec), {
				...args.paths !== void 0 && args.paths.length > 0 ? { paths: args.paths } : {},
				...args.all === true ? { all: true } : {}
			}, exec.signal));
		}
	}));
	ctx.tools.register(defineTool({
		name: "git_unstage",
		description: "Unstage indexed changes: the index entries return to HEAD while the file contents stay untouched. Explicit repository-relative paths, or the whole index with all: true. Requires a write-capable permission preset.",
		parameters: {
			paths: {
				type: "array",
				items: { type: "string" },
				description: "Repository-relative paths to unstage. Required unless all is true."
			},
			all: {
				type: "boolean",
				description: "Unstage the entire index."
			},
			workdir: {
				type: "string",
				description: "Working directory for the repository. Defaults to the session workspace; a relative path is resolved against it."
			}
		},
		output: {
			schema: {
				type: "object",
				additionalProperties: false,
				properties: { stagedPaths: {
					type: "array",
					required: true,
					items: { type: "string" }
				} }
			},
			render: (_args, value) => [{
				type: "text",
				text: value.stagedPaths.length === 0 ? "nothing staged" : `still staged (${value.stagedPaths.length}):\n${value.stagedPaths.join("\n")}`
			}]
		},
		async execute(args, exec) {
			return stageToJson(await ctx.git.unstage(resolveCwd(args.workdir, exec), {
				...args.paths !== void 0 && args.paths.length > 0 ? { paths: args.paths } : {},
				...args.all === true ? { all: true } : {}
			}, exec.signal));
		}
	}));
	ctx.tools.register(defineTool({
		name: "git_commit",
		description: "Create one git commit from the staged index with the given message. Write the message yourself from the staged diff (git_diff with staged: true); its first line becomes the subject. Repository git hooks run as usual. Requires a write-capable permission preset.",
		parameters: {
			message: {
				type: "string",
				required: true,
				description: "The commit message; non-empty, first line is the subject."
			},
			workdir: {
				type: "string",
				description: "Working directory for the repository. Defaults to the session workspace; a relative path is resolved against it."
			}
		},
		output: {
			schema: {
				type: "object",
				additionalProperties: false,
				properties: {
					hash: {
						type: "string",
						required: true
					},
					shortHash: {
						type: "string",
						required: true
					},
					subject: {
						type: "string",
						required: true
					}
				}
			},
			render: (_args, value) => [{
				type: "text",
				text: `committed ${value.shortHash} ${value.subject}`
			}]
		},
		async execute(args, exec) {
			return await ctx.git.commit(resolveCwd(args.workdir, exec), { message: args.message }, exec.signal);
		}
	}));
	ctx.tools.register(defineTool({
		name: "git_push",
		description: "Push the current branch to its upstream, or an explicit remote and branch. set_upstream: true binds the branch to remote/branch while pushing. Requires a write-capable permission preset and configured remote credentials.",
		parameters: {
			remote: {
				type: "string",
				description: "Remote to push to, e.g. origin. Defaults to the branch tracking remote."
			},
			branch: {
				type: "string",
				description: "Branch to push. Defaults to the current branch when a remote is given."
			},
			set_upstream: {
				type: "boolean",
				description: "Set the branch upstream to remote/branch while pushing."
			},
			workdir: {
				type: "string",
				description: "Working directory for the repository. Defaults to the session workspace; a relative path is resolved against it."
			}
		},
		output: {
			schema: {
				type: "object",
				additionalProperties: false,
				properties: {
					remote: {
						type: "string",
						required: true
					},
					branch: {
						type: "string",
						required: true
					},
					setUpstream: {
						type: "boolean",
						required: true
					}
				}
			},
			render: (_args, value) => [{
				type: "text",
				text: `pushed ${value.branch} to ${value.remote}`
			}]
		},
		async execute(args, exec) {
			return await ctx.git.push(resolveCwd(args.workdir, exec), {
				...args.remote !== void 0 && args.remote !== "" ? { remote: args.remote } : {},
				...args.branch !== void 0 && args.branch !== "" ? { branch: args.branch } : {},
				...args.set_upstream === true ? { setUpstream: true } : {}
			}, exec.signal);
		}
	}));
}
//#endregion
export { Config, apply, inject, name };
