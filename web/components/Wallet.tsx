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
  injectedProviders,
  isEip1193Provider,
  type Eip1193Provider,
} from "@/lib/wallet-provider";

type WalletState = {
  address: `0x${string}` | null;
  session: WalletSession | null;
  hasWallet: boolean;
  walletChainId: number | null;
  wrongChain: boolean;
  busy: boolean;
  error: string;
  connect: () => Promise<void>;
  switchChain: () => Promise<void>;
  disconnect: () => void;
};

const WalletContext = createContext<WalletState | null>(null);

export function WalletProvider({ children }: { children: ReactNode }) {
  const [address, setAddress] = useState<`0x${string}` | null>(null);
  const [provider, setProvider] = useState<Eip1193Provider | null>(null);
  const [walletId, setWalletId] = useState<number | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const findWallet = useCallback((): Eip1193Provider | null => {
    if (typeof window === "undefined") return null;
    const found = injectedProviders(window as { ethereum?: unknown });
    const selected = found[0] ?? null;
    if (selected) setProvider((current) => current && found.includes(current) ? current : selected);
    return selected;
  }, []);

  const refreshChain = useCallback(async () => {
    setWalletId(await walletChainId(provider));
  }, [provider]);

  useEffect(() => {
    findWallet();
    if (typeof window === "undefined") return;
    const announce = (event: Event) => {
      const candidate = (event as CustomEvent<{ provider?: unknown }>).detail?.provider;
      if (isEip1193Provider(candidate)) setProvider((current) => current ?? candidate);
    };
    const injected = () => findWallet();
    window.addEventListener("eip6963:announceProvider", announce);
    window.addEventListener("ethereum#initialized", injected, { once: true });
    window.dispatchEvent(new Event("eip6963:requestProvider"));
    const retry = window.setTimeout(findWallet, 250);
    return () => {
      window.removeEventListener("eip6963:announceProvider", announce);
      window.removeEventListener("ethereum#initialized", injected);
      window.clearTimeout(retry);
    };
  }, [findWallet]);

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

  const connect = useCallback(async () => {
    setError("");
    const selected = provider ?? findWallet();
    if (!selected) {
      setError("No EIP-1193 wallet was detected. Open or unlock your wallet, then try again.");
      return;
    }
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
  }, [provider, findWallet]);

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
      hasWallet: provider !== null,
      walletChainId: walletId,
      wrongChain: address !== null && walletId !== null && walletId !== CHAIN_ID,
      busy,
      error,
      connect,
      switchChain,
      disconnect,
    }),
    [address, provider, walletId, busy, error, connect, switchChain, disconnect],
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
  const { address, hasWallet, wrongChain, busy, error, connect, switchChain, disconnect } = useWallet();

  if (!hasWallet) {
    return (
      <div className="flex items-center gap-2">
        <button type="button" className="press" onClick={() => void connect()} disabled={busy}>
          {busy ? "connecting…" : "connect wallet"}
        </button>
        {error && <span className="marginal text-breaking" title={error}>wallet not detected</span>}
      </div>
    );
  }
  if (!address) {
    return (
      <button type="button" className="press" onClick={() => void connect()} disabled={busy}>
        {busy ? "connecting…" : "connect wallet"}
      </button>
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
