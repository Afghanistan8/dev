// Where the console looks for Dev.
//
// The chain comes from the SDK's own definitions, not from values written out
// here: the chain id is signed over, so a pair invented in the app produces
// signatures the network will not accept. As of genlayer-js 1.1.8 the SDK
// defines studionet (61999, studio.genlayer.com), localnet (61127),
// testnetAsimov (4212) and testnetBradbury (4221).
//
// There is no mock chain in this path.

import { localnet, studionet, testnetAsimov, testnetBradbury } from "genlayer-js/chains";
import type { GenLayerChain } from "genlayer-js/types";

export const KNOWN: readonly GenLayerChain[] = [
  studionet,
  testnetAsimov,
  testnetBradbury,
  localnet,
];

export const ZERO_ADDRESS = `0x${"0".repeat(40)}` as const;

function number(value: string | undefined, fallback: number): number {
  const parsed = Number(value);
  return Number.isFinite(parsed) && parsed > 0 ? parsed : fallback;
}

export const CHAIN_ID = number(process.env.NEXT_PUBLIC_DEV_CHAIN_ID, studionet.id);

/** The SDK's definition for this id, when it has one. */
const matched = KNOWN.find((held) => held.id === CHAIN_ID);

export const RPC_URL =
  process.env.NEXT_PUBLIC_DEV_RPC ||
  matched?.rpcUrls.default.http[0] ||
  (studionet.rpcUrls.default.http[0] as string);

export const NETWORK_NAME = matched?.name ?? `chain ${CHAIN_ID}`;

/** True when the id is one the SDK knows, so its consensus contracts apply. */
export const CHAIN_KNOWN = matched !== undefined;

export const CONTRACT_ADDRESS = (process.env.NEXT_PUBLIC_DEV_CONTRACT ||
  ZERO_ADDRESS) as `0x${string}`;

export const CONTRACT_SET = CONTRACT_ADDRESS !== ZERO_ADDRESS;

export const EXPLORER_URL =
  CHAIN_ID === studionet.id
    ? "https://explorer-studio.genlayer.com"
    : (matched?.blockExplorers?.default?.url ?? "");

export const explorerAddress = (address: string): string =>
  EXPLORER_URL ? `${EXPLORER_URL}/address/${address}` : "";

export const explorerTx = (hash: string): string =>
  EXPLORER_URL ? `${EXPLORER_URL}/tx/${hash}` : "";

/**
 * The chain the client works against.
 *
 * The SDK's definition carries the consensus and fee contract addresses, so it
 * is used whole wherever the id is one the SDK knows; only the endpoint is ever
 * overridden. An unknown id keeps Studio's shape, which is why `CHAIN_KNOWN` is
 * exported -- a page can say so rather than letting a write fail at signing
 * time with "consensus main contract address not found".
 */
export const chain: GenLayerChain = (() => {
  const base = matched ?? studionet;
  if (base.rpcUrls.default.http[0] === RPC_URL && base.id === CHAIN_ID) {
    return base;
  }
  return {
    ...base,
    id: CHAIN_ID,
    name: NETWORK_NAME,
    rpcUrls: {
      ...base.rpcUrls,
      default: { ...base.rpcUrls.default, http: [RPC_URL] },
    },
  };
})();

/** The wallet's chain id as a number, or null when no wallet answers. */
export async function walletChainId(): Promise<number | null> {
  const provider = browserProvider();
  if (!provider) return null;
  try {
    const hex = (await provider.request({ method: "eth_chainId" })) as string;
    const parsed = Number.parseInt(hex, 16);
    return Number.isFinite(parsed) ? parsed : null;
  } catch {
    return null;
  }
}

export function browserProvider(): Eip1193Provider | null {
  const held = (globalThis as { ethereum?: Eip1193Provider }).ethereum;
  return held ?? null;
}

export type Eip1193Provider = {
  request: (args: { method: string; params?: unknown[] | object }) => Promise<unknown>;
  on?: (event: string, handler: (...args: never[]) => void) => void;
  removeListener?: (event: string, handler: (...args: never[]) => void) => void;
};
