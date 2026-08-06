// Credential store by reference (ADR-0006/0007). The DB stores only a
// `token_ref`; token MATERIAL lives in an external store. For the local MVP the
// store is an in-memory Map + env override; production swaps in a real vault
// (HashiCorp/AWS Secrets Manager) behind the same two functions.
//
// IMPORTANT: never log, persist, or return token material through the publish
// pipeline — only the reference travels.

const memory: Map<string, string> = new Map();

export interface SecretStore {
  put(material: string): Promise<string>;
  get(ref: string): Promise<string | undefined>;
  delete(ref: string): Promise<void>;
}

/**
 * Create a secret store. `useMemory` forces the in-memory implementation (used
 * by tests so no env mutation is needed). Default resolves token material from
 * the local store, falling back to `process.env[ref]` for env-managed secrets.
 */
export function createSecretStore(useMemory = false): SecretStore {
  return {
    async put(material: string): Promise<string> {
      if (useMemory) {
        const ref = `secret:${crypto.randomUUID()}`;
        memory.set(ref, material);
        return ref;
      }
      const ref = `secret:${crypto.randomUUID()}`;
      memory.set(ref, material);
      return ref;
    },
    async get(ref: string): Promise<string | undefined> {
      const fromMemory = memory.get(ref);
      if (fromMemory !== undefined) return fromMemory;
      // Env-managed: allow a ref that names an env var (e.g. 'YOUTUBE_ACCESS_TOKEN').
      if (ref.startsWith('env:')) return process.env[ref.slice(4)];
      return memory.get(ref) ?? undefined;
    },
    async delete(ref: string): Promise<void> {
      memory.delete(ref);
    },
  };
}

/** Default singleton store (in-memory + env fallback). */
export const secretStore = createSecretStore(false);

/** Convenience: store token material and return a reference. */
export async function storeSecret(material: string): Promise<string> {
  return secretStore.put(material);
}

/** Convenience: resolve token material from a reference. */
export async function resolveToken(ref: string): Promise<string | undefined> {
  return secretStore.get(ref);
}
