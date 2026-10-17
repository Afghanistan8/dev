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

export type WalletCandidate = {
  provider: Eip1193Provider;
  /** Stable when announced through EIP-6963; otherwise derived locally. */
  id: string;
  name: string;
  icon?: string;
};

type Eip6963Announcement = {
  provider?: unknown;
  info?: { uuid?: unknown; name?: unknown; icon?: unknown };
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

/** A readable fallback for legacy injections that do not publish EIP-6963 info. */
export function providerName(provider: Eip1193Provider): string {
  const branded = provider as Eip1193Provider & Record<string, unknown>;
  if (branded.isMetaMask === true) return "MetaMask";
  if (branded.isRabby === true) return "Rabby";
  if (branded.isCoinbaseWallet === true) return "Coinbase Wallet";
  if (branded.isKeplr === true) return "Keplr";
  return "Injected wallet";
}

export function legacyWalletCandidates(scope: ProviderScope): WalletCandidate[] {
  return injectedProviders(scope).map((provider, index) => ({
    provider,
    id: `injected-${index}`,
    name: providerName(provider),
  }));
}

/** Safely parse the browser event sent by an EIP-6963 wallet extension. */
export function announcedWalletCandidate(detail: unknown): WalletCandidate | null {
  const announcement = detail as Eip6963Announcement | null;
  if (!announcement || !isEip1193Provider(announcement.provider)) return null;
  const name = typeof announcement.info?.name === "string" && announcement.info.name.trim()
    ? announcement.info.name.trim()
    : providerName(announcement.provider);
  return {
    provider: announcement.provider,
    id: typeof announcement.info?.uuid === "string" ? announcement.info.uuid : `announced-${name}`,
    name,
    icon: typeof announcement.info?.icon === "string" ? announcement.info.icon : undefined,
  };
}

/** Keep one entry per provider and let the richer EIP-6963 label replace a fallback. */
export function mergeWalletCandidates(
  current: WalletCandidate[],
  incoming: WalletCandidate[],
): WalletCandidate[] {
  const merged = [...current];
  for (const candidate of incoming) {
    const index = merged.findIndex((known) => known.provider === candidate.provider);
    if (index === -1) merged.push(candidate);
    else {
      const known = merged[index]!;
      // Polling the legacy injection again must not erase a proper EIP-6963
      // name/icon that was announced earlier.
      merged[index] = candidate.id.startsWith("injected-") && !known.id.startsWith("injected-")
        ? known
        : { ...known, ...candidate };
    }
  }
  return merged;
}
