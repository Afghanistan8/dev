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

import { CHAIN_ID, NETWORK_NAME, RPC_URL, browserProvider, chain, walletChainId } from "@/lib/chain";
import { describeRefusal, walletClient, type WalletSession } from "@/lib/dev";

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
  const [walletId, setWalletId] = useState<number | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const hasWallet = typeof globalThis !== "undefined" && browserProvider() !== null;

  const refreshChain = useCallback(async () => {
    setWalletId(await walletChainId());
  }, []);

  useEffect(() => {
    const provider = browserProvider();
    if (!provider?.on) return;
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
  }, [refreshChain]);

  const connect = useCallback(async () => {
    setError("");
    const provider = browserProvider();
    if (!provider) {
      setError("No wallet is installed. Dev is read-only without one.");
      return;
    }
    setBusy(true);
    try {
      const accounts = (await provider.request({ method: "eth_requestAccounts" })) as string[];
      const chosen = accounts[0];
      if (!chosen) throw new Error("the wallet returned no account");
      setAddress(chosen as `0x${string}`);
      await refreshChain();
    } catch (trouble) {
      setError(describeRefusal(trouble));
    } finally {
      setBusy(false);
    }
  }, [refreshChain]);

  const switchChain = useCallback(async () => {
    setError("");
    const provider = browserProvider();
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
  }, [refreshChain]);

  const disconnect = useCallback(() => {
    setAddress(null);
    setError("");
  }, []);

  const value = useMemo<WalletState>(
    () => ({
      address,
      session: address ? walletClient(address, browserProvider()) : null,
      hasWallet,
      walletChainId: walletId,
      wrongChain: address !== null && walletId !== null && walletId !== CHAIN_ID,
      busy,
      error,
      connect,
      switchChain,
      disconnect,
    }),
    [address, hasWallet, walletId, busy, error, connect, switchChain, disconnect],
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
  const { address, hasWallet, wrongChain, busy, connect, switchChain, disconnect } = useWallet();

  if (!hasWallet) {
    return <span className="marginal" title="Install a wallet to submit proposals">read-only · no wallet</span>;
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
