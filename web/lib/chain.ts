// Where the console looks for Dev.
//
// The chain comes from the SDK's own definitions, not from values written out
// here: the chain id is signed over, so a pair invented in the app produces
// signatures the network will not accept. Dev deliberately fixes that
// definition and endpoint to stable Studionet (61999); there is no mock,
// fallback, or environment-selected chain in this path.

import { studionet } from "genlayer-js/chains";
import type { GenLayerChain } from "genlayer-js/types";

import type { Eip1193Provider } from "./wallet-provider";

export const ZERO_ADDRESS = `0x${"0".repeat(40)}` as const;

function assertStudionetConfiguration() {
  const chainId = process.env.NEXT_PUBLIC_DEV_CHAIN_ID;
  const rpc = process.env.NEXT_PUBLIC_DEV_RPC;
  const expectedRpc = String(studionet.rpcUrls.default.http[0]).replace(/\/$/, "");
  if (chainId && chainId !== String(studionet.id)) {
    throw new Error(`Dev only operates on Studionet (${studionet.id}); NEXT_PUBLIC_DEV_CHAIN_ID is refused.`);
  }
  if (rpc && rpc.replace(/\/$/, "") !== expectedRpc) {
    throw new Error(`Dev only operates through ${expectedRpc}; NEXT_PUBLIC_DEV_RPC is refused.`);
  }
}

assertStudionetConfiguration();

export const CHAIN_ID = studionet.id;
export const RPC_URL = studionet.rpcUrls.default.http[0] as string;
export const NETWORK_NAME = studionet.name;

export const CONTRACT_ADDRESS = (process.env.NEXT_PUBLIC_DEV_CONTRACT ||
  ZERO_ADDRESS) as `0x${string}`;

export const CONTRACT_SET = CONTRACT_ADDRESS !== ZERO_ADDRESS;

export const EXPLORER_URL = "https://explorer-studio.genlayer.com";

export const explorerAddress = (address: string): string =>
  EXPLORER_URL ? `${EXPLORER_URL}/address/${address}` : "";

export const explorerTx = (hash: string): string =>
  EXPLORER_URL ? `${EXPLORER_URL}/tx/${hash}` : "";

/**
 * The chain the client works against.
 *
 * The SDK's Studionet definition carries the consensus and fee contract
 * addresses. It is used whole: neither its id nor its endpoint may be
 * overridden by a browser environment variable.
 */
export const chain: GenLayerChain = studionet;

/** The wallet's chain id as a number, or null when no wallet answers. */
export async function walletChainId(provider: Eip1193Provider | null): Promise<number | null> {
  if (!provider) return null;
  try {
    const hex = (await provider.request({ method: "eth_chainId" })) as string;
    const parsed = Number.parseInt(hex, 16);
    return Number.isFinite(parsed) ? parsed : null;
  } catch {
    return null;
  }
}
