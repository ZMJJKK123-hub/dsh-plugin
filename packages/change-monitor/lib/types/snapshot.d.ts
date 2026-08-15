/**
 * Workspace snapshotting: a bounded walk of the workspace root recording
 * per-file metadata (size, mtime, content hash, text/binary/large kind).
 * The turn-start baseline retains decoded content (the disk is overwritten
 * by the turn, so only the snapshot can later supply the before text); the
 * turn-end view keeps metadata and hash only, and the diff engine re-reads
 * changed files from disk — so the expensive retained-content path runs
 * once per turn, not twice. A fast metadata-only scan supports the settle
 * check.
 *
 * @module @dsh-custom/dsh-change-monitor
 */
import type { CompiledIgnore } from './ignore.ts';
/** How a file is classified for diffing. */
export type SnapshotFileKind = 'text' | 'binary' | 'large';
/** Immutable per-file snapshot metadata. */
export interface SnapshotFileMeta {
    readonly size: number;
    readonly mtimeNs: number;
    /** SHA-256 hex over the file bytes; null for files above the snapshot cap. */
    readonly hash: string | null;
    readonly kind: SnapshotFileKind;
    /**
     * Decoded UTF-8 content, retained for text files at or below the snapshot
     * cap. The diff engine reads ONLY this snapshot content — never the disk —
     * so a file modified after its snapshot still diffs against what the
     * snapshot saw. Held transiently for the turn window, then released.
     */
    readonly content?: string;
}
/** One point-in-time view of the workspace. */
export interface WorkspaceSnapshot {
    readonly root: string;
    readonly time: number;
    readonly files: ReadonlyMap<string, SnapshotFileMeta>;
}
/** Snapshot behavior knobs (monitor config supplies the values). */
export interface SnapshotOptions {
    /** Files at or above this byte size get metadata only (no hash). */
    readonly maxSnapshotFileSize: number;
    /** Compiled ignore set. */
    readonly ignore: CompiledIgnore;
    /**
     * Retain decoded UTF-8 content for text files at or below the cap. The
     * turn-start baseline must retain content (the disk is overwritten by the
     * turn, so only the snapshot can later supply the before text); the
     * turn-end view can skip it and the diff reads changed files from disk.
     * Defaults to true.
     */
    readonly retainContent?: boolean;
}
/**
 * Snapshot every non-ignored file under `root`. Errors on individual files
 * (permission, races, encoding) are contained: the walker skips the file and
 * keeps going, so one unreadable path cannot fail the turn.
 * @param root - workspace root directory.
 * @param options - cap, ignore set, and content-retention choice.
 * @returns the snapshot, whose `files` map is never mutated afterwards.
 */
export declare function snapshotWorkspace(root: string, options: SnapshotOptions): Promise<WorkspaceSnapshot>;
/** One file's quick stability token for the settle check. */
export interface MetadataToken {
    readonly size: number;
    readonly mtimeNs: number;
}
/**
 * Fast metadata-only scan of the workspace: `relPath -> size:mtime` tokens
 * without reading any content. Used to detect whether the tree has stopped
 * changing after a turn ends.
 */
export declare function scanMetadata(root: string, ignore: CompiledIgnore): Promise<Map<string, MetadataToken>>;
/** Whether two metadata scans agree on the whole tree. */
export declare function sameMetadata(left: ReadonlyMap<string, MetadataToken>, right: ReadonlyMap<string, MetadataToken>): boolean;
/**
 * Read one file's bytes as UTF-8 text, or report it as binary/large.
 * @param absolute - file path to read.
 * @param maxBytes - files at or above this size are reported as `large` without reading.
 * @returns decoded text, or null when the file is binary, oversized, or unreadable.
 */
export declare function readTextFile(absolute: string, maxBytes: number): Promise<string | null>;
/** Normalize a workspace-relative path to forward slashes for storage. */
export declare function toRelativePath(root: string, absolute: string): string;
/** Whether a stored relative path stays inside the workspace (no traversal). */
export declare function isSafeRelativePath(path: string): boolean;
/** Reject an absolute path outside the root before any file access. */
export declare function assertInsideRoot(root: string, absolute: string): void;
/** lstat-based directory check used by tests and the walker's helpers. */
export declare function isDirectory(absolute: string): Promise<boolean>;
//# sourceMappingURL=snapshot.d.ts.map