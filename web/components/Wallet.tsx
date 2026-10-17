"use client";

// The wallet, in one place.
//
// Dev has no backend and no server-held key: every write is signed by the
// wallet the visitor connects. This provider keeps the connected address and a
// ready-to-use client, warns when the wallet is on another chain, and offers to
// add or switch to the one Dev is deployed on. A visitor without a wallet can
// still read everything; the pages say so rather than failing at signing time.

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from "react";

import { CHAIN_ID, NETWORK_NAME, RPC_URL, chain, walletChainId } from "@/lib/chain";
import { describeRefusal, walletClient, type WalletSession } from "@/lib/dev";
import {
  announcedWalletCandidate,
  legacyWalletCandidates,
  mergeWalletCandidates,
  type Eip1193Provider,
  type WalletCandidate,
} from "@/lib/wallet-provider";

type WalletState = {
  address: `0x${string}` | null;
  session: WalletSession | null;
  hasWallet: boolean;
  wallets: WalletCandidate[];
  walletChainId: number | null;
  wrongChain: boolean;
  busy: boolean;
  error: string;
  discoverWallets: () => WalletCandidate[];
  connect: (chosen?: Eip1193Provider) => Promise<void>;
  switchChain: () => Promise<void>;
  disconnect: () => void;
};

const WalletContext = createContext<WalletState | null>(null);

export function WalletProvider({ children }: { children: ReactNode }) {
  const [address, setAddress] = useState<`0x${string}` | null>(null);
  const [provider, setProvider] = useState<Eip1193Provider | null>(null);
  const [wallets, setWallets] = useState<WalletCandidate[]>([]);
  const [walletId, setWalletId] = useState<number | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const discoverWallets = useCallback((): WalletCandidate[] => {
    if (typeof window === "undefined") return [];
    const found = legacyWalletCandidates(window as { ethereum?: unknown });
    setWallets((current) => mergeWalletCandidates(current, found));
    return found;
  }, []);

  const refreshChain = useCallback(async () => {
    setWalletId(await walletChainId(provider));
  }, [provider]);

  useEffect(() => {
    discoverWallets();
    if (typeof window === "undefined") return;
    const announce = (event: Event) => {
      const candidate = announcedWalletCandidate((event as CustomEvent<unknown>).detail);
      if (candidate) setWallets((current) => mergeWalletCandidates(current, [candidate]));
    };
    const injected = () => discoverWallets();
    window.addEventListener("eip6963:announceProvider", announce);
    window.addEventListener("ethereum#initialized", injected, { once: true });
    window.dispatchEvent(new Event("eip6963:requestProvider"));
    const retry = window.setTimeout(discoverWallets, 250);
    return () => {
      window.removeEventListener("eip6963:announceProvider", announce);
      window.removeEventListener("ethereum#initialized", injected);
      window.clearTimeout(retry);
    };
  }, [discoverWallets]);

  useEffect(() => {
    if (!provider) return;
    void refreshChain();
    if (!provider.on) return;
    const onAccounts = (...args: never[]) => {
      const accounts = args[0] as unknown as string[];
      setAddress(accounts.length > 0 ? (accounts[0] as `0x${string}`) : null);
    };
    const onChain = () => void refreshChain();
    provider.on("accountsChanged", onAccounts);
    provider.on("chainChanged", onChain);
    return () => {
      provider.removeListener?.("accountsChanged", onAccounts);
      provider.removeListener?.("chainChanged", onChain);
    };
  }, [provider, refreshChain]);

  const connect = useCallback(async (chosen?: Eip1193Provider) => {
    setError("");
    const discovered = discoverWallets();
    const selected = chosen ?? provider ?? (wallets.length === 1
      ? wallets[0]?.provider ?? null
      : discovered.length === 1 ? discovered[0]?.provider ?? null : null);
    if (!selected) {
      setError(
        wallets.length + discovered.length > 1
          ? "Choose the wallet you want to connect."
          : "No EIP-1193 wallet was detected. Open or unlock your wallet, then try again.",
      );
      return;
    }
    setProvider(selected);
    setBusy(true);
    try {
      const accounts = (await selected.request({ method: "eth_requestAccounts" })) as string[];
      const chosen = accounts[0];
      if (!chosen) throw new Error("the wallet returned no account");
      setAddress(chosen as `0x${string}`);
      setWalletId(await walletChainId(selected));
    } catch (trouble) {
      setError(describeRefusal(trouble));
    } finally {
      setBusy(false);
    }
  }, [provider, wallets, discoverWallets]);

  const switchChain = useCallback(async () => {
    setError("");
    if (!provider) return;
    setBusy(true);
    try {
      const hex = `0x${CHAIN_ID.toString(16)}`;
      try {
        await provider.request({
          method: "wallet_switchEthereumChain",
          params: [{ chainId: hex }],
        });
      } catch {
        await provider.request({
          method: "wallet_addEthereumChain",
          params: [
            {
              chainId: hex,
              chainName: NETWORK_NAME,
              rpcUrls: [RPC_URL],
              nativeCurrency: { name: "GEN", symbol: "GEN", decimals: 18 },
              blockExplorerUrls: chain.blockExplorers?.default?.url
                ? [chain.blockExplorers.default.url]
                : [],
            },
          ],
        });
      }
      await refreshChain();
    } catch (trouble) {
      setError(describeRefusal(trouble));
    } finally {
      setBusy(false);
    }
  }, [provider, refreshChain]);

  const disconnect = useCallback(() => {
    setAddress(null);
    setError("");
  }, []);

  const value = useMemo<WalletState>(
    () => ({
      address,
      session: address && provider ? walletClient(address, provider) : null,
      hasWallet: wallets.length > 0,
      wallets,
      walletChainId: walletId,
      wrongChain: address !== null && walletId !== null && walletId !== CHAIN_ID,
      busy,
      error,
      discoverWallets,
      connect,
      switchChain,
      disconnect,
    }),
    [address, provider, wallets, walletId, busy, error, discoverWallets, connect, switchChain, disconnect],
  );

  return <WalletContext.Provider value={value}>{children}</WalletContext.Provider>;
}

export function useWallet(): WalletState {
  const held = useContext(WalletContext);
  if (!held) throw new Error("useWallet must be used inside a WalletProvider");
  return held;
}

/** The connect control that lives in the header. */
export function WalletBar() {
  const {
    address,
    hasWallet,
    wallets,
    wrongChain,
    busy,
    error,
    discoverWallets,
    connect,
    switchChain,
    disconnect,
  } = useWallet();
  const [pickerOpen, setPickerOpen] = useState(false);

  const beginConnect = () => {
    const found = discoverWallets();
    const choices = mergeWalletCandidates(wallets, found);
    if (choices.length > 1) {
      setPickerOpen(true);
      return;
    }
    void connect(choices[0]?.provider);
  };

  const picker = pickerOpen && (
    <div className="absolute right-0 top-full z-50 mt-2 w-64 border border-rule bg-ink-850 p-2 shadow-2xl" role="dialog" aria-label="Choose wallet">
      <p className="marginal mb-2 px-2">choose wallet</p>
      {wallets.map((wallet) => (
        <button
          key={wallet.id}
          type="button"
          className="flex w-full items-center gap-2 px-2 py-2 text-left font-hand text-sm text-bone hover:bg-ink-700"
          onClick={() => {
            setPickerOpen(false);
            void connect(wallet.provider);
          }}
          disabled={busy}
        >
          {wallet.icon ? <img src={wallet.icon} alt="" className="h-5 w-5 rounded-sm" /> : <span className="h-5 w-5 border border-rule-bright" />}
          <span>{wallet.name}</span>
        </button>
      ))}
    </div>
  );

  if (!hasWallet) {
    return (
      <div className="relative flex items-center gap-2">
        <button type="button" className="press" onClick={beginConnect} disabled={busy}>
          {busy ? "connecting…" : "connect wallet"}
        </button>
        {error && <span className="marginal text-breaking" title={error}>wallet not detected</span>}
        {picker}
      </div>
    );
  }
  if (!address) {
    return (
      <div className="relative">
        <button type="button" className="press" onClick={beginConnect} disabled={busy}>
          {busy ? "connecting…" : wallets.length > 1 ? "choose wallet" : "connect wallet"}
        </button>
        {picker}
      </div>
    );
  }
  if (wrongChain) {
    return (
      <button type="button" className="press" onClick={() => void switchChain()} disabled={busy}>
        {busy ? "switching…" : `switch to chain ${CHAIN_ID}`}
      </button>
    );
  }
  return (
    <button
      type="button"
      className="marginal hover:text-seal"
      onClick={disconnect}
      title={`${address} — click to disconnect`}
    >
      {address.slice(0, 6)}…{address.slice(-4)}
    </button>
  );
}
