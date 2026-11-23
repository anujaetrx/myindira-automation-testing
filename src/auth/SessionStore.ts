import fs from 'node:fs';
import path from 'node:path';
import { env, type Role } from '@config/environment';
import { STORAGE_DIR } from '@config/projects.config';
import type { AuthResult, SessionMeta, StorageState } from './types';

export interface StoredSession {
  statePath: string;
  state: StorageState;
  meta: SessionMeta;
  sessionStorage?: Record<string, string>;
}

/**
 * Session persistence. One folder per environment, so QA and Staging sessions can never mix:
 *   storage-state/<env>/<role>.state.json   Playwright storage state
 *   storage-state/<env>/<role>.meta.json    when/how it was created, and when it expires
 * Writes are atomic (temp file + rename) because parallel workers may read while another writes.
 */
export class SessionStore {
  constructor(private readonly baseDir: string = path.join(STORAGE_DIR, env.name)) {}

  statePath(role: Role): string {
    return path.join(this.baseDir, `${role}.state.json`);
  }

  private sessionStoragePath(role: Role): string {
    return path.join(this.baseDir, `${role}.session-storage.json`);
  }

  private metaPath(role: Role): string {
    return path.join(this.baseDir, `${role}.meta.json`);
  }

  save(role: Role, result: AuthResult, meta: Omit<SessionMeta, 'role' | 'strategy'>): string {
    fs.mkdirSync(this.baseDir, { recursive: true });
    this.atomicWrite(this.statePath(role), result.storageState);
    this.atomicWrite(this.metaPath(role), { ...meta, role, strategy: result.strategy });
    if (result.sessionStorage && Object.keys(result.sessionStorage).length > 0) {
      this.atomicWrite(this.sessionStoragePath(role), result.sessionStorage);
    } else {
      fs.rmSync(this.sessionStoragePath(role), { force: true });
    }
    return this.statePath(role);
  }

  load(role: Role): StoredSession | null {
    try {
      const statePath = this.statePath(role);
      const state = JSON.parse(fs.readFileSync(statePath, 'utf-8')) as StorageState;
      const meta = JSON.parse(fs.readFileSync(this.metaPath(role), 'utf-8')) as SessionMeta;
      const sessionStorage = fs.existsSync(this.sessionStoragePath(role))
        ? (JSON.parse(fs.readFileSync(this.sessionStoragePath(role), 'utf-8')) as Record<string, string>)
        : undefined;
      return { statePath, state, meta, sessionStorage };
    } catch {
      return null; // missing or corrupt: treat as "no session"
    }
  }

  delete(role: Role): void {
    fs.rmSync(this.statePath(role), { force: true });
    fs.rmSync(this.metaPath(role), { force: true });
    fs.rmSync(this.sessionStoragePath(role), { force: true });
  }

  deleteAll(): void {
    fs.rmSync(this.baseDir, { recursive: true, force: true });
  }

  private atomicWrite(file: string, data: unknown): void {
    const tmp = `${file}.${process.pid}.tmp`;
    fs.writeFileSync(tmp, JSON.stringify(data, null, 2), { mode: 0o600 });
    fs.renameSync(tmp, file);
  }
}
