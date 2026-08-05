// Reference-Based Data Plane (Milestone 5). Workers write media to a local
// directory and return a URI reference — never binary through the orchestrator
// (per mvp-architecture.md §3 "The Pointer System").

import { mkdirSync, writeFileSync, existsSync, readFileSync } from 'node:fs';
import { join, resolve } from 'node:path';
import { randomUUID } from 'node:crypto';

/** Root of the local media output (MVP: /tmp/fyi-studio, later S3/R2). */
export function mediaRoot(): string {
  return process.env.FYI_MEDIA_ROOT ?? '/tmp/fyi-studio';
}

/** Ensure the media root exists and return its absolute path. */
export function ensureMediaRoot(): string {
  const root = resolve(mediaRoot());
  mkdirSync(root, { recursive: true });
  return root;
}

/** Create a per-execution output directory and return { dir, execId }. */
export function execMediaDir(execution_id: string): { dir: string; execId: string } {
  const execId = execution_id || randomUUID();
  const dir = join(ensureMediaRoot(), execId);
  mkdirSync(dir, { recursive: true });
  return { dir, execId };
}

/** Write a text file (e.g. .srt) into a media dir and return its reference URI. */
export function writeTextAsset(execution_id: string, filename: string, content: string): string {
  const { dir } = execMediaDir(execution_id);
  const abs = join(dir, filename);
  writeFileSync(abs, content, 'utf8');
  return abs;
}

/** Read a text asset back (e.g. .srt). Returns undefined if missing. */
export function readTextAsset(absPath: string): string | undefined {
  return existsSync(absPath) ? readFileSync(absPath, 'utf8') : undefined;
}

/** Build a media reference URI for an absolute local path. */
export function toReference(absPath: string): string {
  return `file://${absPath}`;
}
