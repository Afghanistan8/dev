// Discover EIP-1193 wallet providers without assuming one extension, one
// injection time, or one browser. Wallet extensions can inject after React has
// hydrated, and modern browsers can expose more than one provider through
// EIP-6963. The UI owns event-based discovery; these pure helpers make the
// selection rule small and testable.

export type Eip1193Provider = {
  request: (args: { method: string; params?: unknown[] | object }) => Promise<unknown>;
  on?: (event: string, handler: (...args: never[]) => void) => void;
  removeListener?: (event: string, handler: (...args: never[]) => void) => void;
  providers?: unknown[];
};

type ProviderScope = { ethereum?: unknown };

export function isEip1193Provider(value: unknown): value is Eip1193Provider {
  return Boolean(value) && typeof value === "object" &&
    typeof (value as { request?: unknown }).request === "function";
}

/**
 * Return each injected provider once. `ethereum.providers` is the legacy
 * multi-wallet convention; the root provider remains a valid fallback.
 */
export function injectedProviders(scope: ProviderScope): Eip1193Provider[] {
  const root = scope.ethereum;
  const candidates = isEip1193Provider(root) && Array.isArray(root.providers)
    ? [...root.providers, root]
    : [root];
  const found: Eip1193Provider[] = [];
  for (const candidate of candidates) {
    if (isEip1193Provider(candidate) && !found.includes(candidate)) found.push(candidate);
  }
  return found;
}
