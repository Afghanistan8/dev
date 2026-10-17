// Where Dev talks to the chain.
//
// Dev talks to one network: stable Studionet (61999). The chain definition is
// the SDK's own one because its consensus and fee contract addresses are part
// of a valid signed transaction. There is deliberately no fallback, local
// target, or environment-selected network: pointing a deployment or live run
// anywhere else would make its evidence a different system's evidence.

import { studionet } from "genlayer-js/chains";

function target(key, chain, note, explorer = "") {
  return {
    key,
    chain,
    id: chain.id,
    name: chain.name,
    rpc: chain.rpcUrls.default.http[0],
    explorer: explorer || chain.blockExplorers?.default?.url || "",
    note,
  };
}

export const STUDIONET = target(
  "studionet",
  studionet,
  "Studio, the default",
  "https://explorer-studio.genlayer.com",
);
export function refuseAlternateConfiguration(environment = process.env) {
  const network = String(environment.DEV_NETWORK || "studionet").toLowerCase();
  const chainId = String(environment.DEV_CHAIN_ID || STUDIONET.id);
  const rpc = String(environment.DEV_RPC || "");
  const studioRpc = STUDIONET.rpc.replace(/\/$/, "");
  if (network !== "studionet" && network !== String(STUDIONET.id)) {
    throw new Error(`Dev only operates on Studionet (${STUDIONET.id}); DEV_NETWORK=${network} is refused.`);
  }
  if (chainId !== String(STUDIONET.id)) {
    throw new Error(`Dev only operates on Studionet (${STUDIONET.id}); DEV_CHAIN_ID=${chainId} is refused.`);
  }
  if (rpc && rpc.replace(/\/$/, "") !== studioRpc) {
    throw new Error(`Dev only operates through ${STUDIONET.rpc}; DEV_RPC is refused.`);
  }
}

/** Whether an endpoint answers a JSON-RPC call at all. */
export async function reachable(target, timeoutMs = 8000) {
  try {
    const answer = await fetch(target.rpc, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ jsonrpc: "2.0", id: 1, method: "net_version", params: [] }),
      signal: AbortSignal.timeout(timeoutMs),
    });
    return answer.ok;
  } catch {
    return false;
  }
}

/**
 * The only endpoint to work against. Configuration is checked before probing
 * so a failed Studio endpoint can never silently turn into work on another
 * network.
 */
export async function resolveTarget() {
  refuseAlternateConfiguration();
  if (await reachable(STUDIONET)) return { target: STUDIONET, fellBack: false };
  throw new Error(`Studionet (${STUDIONET.rpc}) did not answer; refusing to fall back to another network.`);
}
