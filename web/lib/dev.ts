// Reading Dev, and submitting to it.
//
// Reads go through genlayer-js against the configured endpoint. Writes go
// through the same SDK, but signed by the wallet the user connected: the client
// is built with the connected address and the EIP-1193 provider, so the SDK
// routes `eth_sendTransaction` to the wallet and the app never holds a key.
//
// A Studio transaction is `ACCEPTED` when the validators reached a result and
// `MAJORITY_AGREE` when they agreed about it. Neither says the contract
// returned. The leader receipt does: `execution_result` is `SUCCESS` when the
// method returned and `ERROR` when it raised, and an error's `result.payload`
// carries the `[CODE] message` the contract wears. So a submission is only a
// success when it is decided, agreed, and the leader did not error.

import { createClient } from "genlayer-js";
import type { CalldataEncodable, GenLayerChain, GenLayerClient, Hash } from "genlayer-js/types";

import { CONTRACT_ADDRESS, CONTRACT_SET, RPC_URL, chain } from "./chain";
import type { Submission, SubmissionStage } from "./types";

/** Calldata comes back with Maps in it. Flatten to plain data once, here. */
export function plain(value: unknown): unknown {
  if (value instanceof Map) {
    const out: Record<string, unknown> = {};
    for (const [key, held] of value) out[String(key)] = plain(held);
    return out;
  }
  if (Array.isArray(value)) return value.map(plain);
  if (typeof value === "bigint") return value.toString();
  if (value instanceof Uint8Array) return value;
  if (value && typeof value === "object") {
    const out: Record<string, unknown> = {};
    for (const [key, held] of Object.entries(value)) out[key] = plain(held);
    return out;
  }
  return value;
}

let reader: GenLayerClient<GenLayerChain> | null = null;

function readClient(): GenLayerClient<GenLayerChain> {
  // `endpoint` as well as the chain's own rpcUrls, so the client cannot end up
  // reading from the SDK's URL for this chain rather than the configured one.
  reader ??= createClient({ chain, endpoint: RPC_URL });
  return reader;
}

export class NotDeployed extends Error {
  constructor() {
    super(
      "No contract address is set. Deploy Dev and put its address in " +
        "NEXT_PUBLIC_DEV_CONTRACT.",
    );
    this.name = "NotDeployed";
  }
}

/** One view call. Throws with the contract's own refusal text when it refuses. */
export async function read<T>(
  functionName: string,
  args: CalldataEncodable[] = [],
): Promise<T> {
  if (!CONTRACT_SET) throw new NotDeployed();
  const answer = await readClient().readContract({
    address: CONTRACT_ADDRESS,
    functionName,
    args,
    jsonSafeReturn: true,
  });
  return plain(answer) as T;
}

/** A view that is allowed to refuse: an unknown id is a 404, not a crash. */
export async function tryRead<T>(
  functionName: string,
  args: CalldataEncodable[] = [],
): Promise<{ ok: true; value: T } | { ok: false; error: string }> {
  try {
    return { ok: true, value: await read<T>(functionName, args) };
  } catch (error) {
    return { ok: false, error: describeRefusal(error) };
  }
}

/**
 * Dev's own refusals read as `[CODE] what is wrong`. Pull the sentence out of
 * whatever the transport wrapped it in, and leave anything else alone.
 */
export function describeRefusal(error: unknown): string {
  const text =
    error instanceof Error ? error.message : typeof error === "string" ? error : "";
  const found = text.match(/\[[A-Z][A-Z_]{2,}\][^\n]*/);
  if (found) return found[0].trim();
  return text || "the call failed and said nothing about why";
}

export function refusalCode(error: unknown): string {
  const found = describeRefusal(error).match(/^(\[[A-Z][A-Z_]{2,}\])/);
  return found?.[1] ?? "";
}

// -- submitting ---------------------------------------------------------------

export type WalletSession = {
  client: GenLayerClient<GenLayerChain>;
  address: `0x${string}`;
};

/**
 * A client that signs through the connected wallet. The address alone is the
 * account: the SDK routes the signing methods to the provider, and the app
 * never sees a private key.
 */
export function walletClient(address: `0x${string}`, provider: unknown): WalletSession {
  const client = createClient({
    chain,
    endpoint: RPC_URL,
    account: address,
    provider,
  } as never);
  return { client, address };
}

type Receipt = {
  status?: number | string;
  status_name?: string;
  statusName?: string;
  result?: number;
  result_name?: string;
  resultName?: string;
  consensus_data?: { leader_receipt?: LeaderReceipt[] };
  [key: string]: unknown;
};

type LeaderReceipt = {
  execution_result?: string;
  result?: unknown;
  genvm_result?: { stderr?: string; error_description?: string };
  error?: string;
};

function leaderOf(receipt: Receipt): LeaderReceipt | null {
  const held = receipt.consensus_data?.leader_receipt;
  if (Array.isArray(held)) return held[0] ?? null;
  return (held as LeaderReceipt | undefined) ?? null;
}

function statusOf(receipt: Receipt): string {
  return (
    receipt.status_name ??
    receipt.statusName ??
    (typeof receipt.status === "number" ? String(receipt.status) : (receipt.status ?? "unknown"))
  );
}

function resultOf(receipt: Receipt): string {
  if (receipt.result_name || receipt.resultName) {
    return (receipt.result_name ?? receipt.resultName) as string;
  }
  return receipt.result === 6 ? "MAJORITY_AGREE" : String(receipt.result ?? "unknown");
}

const DECIDED = ["ACCEPTED", "FINALIZED", "UNDETERMINED", "CANCELED", "LEADER_TIMEOUT", "VALIDATORS_TIMEOUT"];

export function isDecided(receipt: Receipt): boolean {
  return DECIDED.includes(statusOf(receipt));
}

/** `SUCCESS` when the leader's method returned, `ERROR` when it raised. */
export function executionOf(receipt: Receipt): string {
  return leaderOf(receipt)?.execution_result ?? "unknown";
}

export function succeeded(receipt: Receipt): boolean {
  const status = statusOf(receipt);
  return (
    (status === "ACCEPTED" || status === "FINALIZED") &&
    resultOf(receipt) === "MAJORITY_AGREE" &&
    executionOf(receipt) !== "ERROR"
  );
}

/** The `[CODE] message` a leader receipt carries when the contract refused. */
export function refusalIn(receipt: Receipt): string {
  const leader = leaderOf(receipt);
  const raw = leader?.result as { payload?: unknown } | undefined;
  const payload = raw && typeof raw === "object" ? raw.payload : raw;
  const parts = [payload, leader?.genvm_result?.stderr, leader?.genvm_result?.error_description, leader?.error]
    .filter((part): part is string => typeof part === "string" && part.length > 0)
    .join(" \n ");
  const found = parts.match(/\[[A-Z][A-Z_]{2,}\][^\n]*/);
  return found?.[0]?.trim() ?? "";
}

const STAGE_STATUS: Partial<Record<string, SubmissionStage>> = {
  ACCEPTED: "accepted",
  FINALIZED: "finalized",
};

/**
 * Drive one write to a decision, reporting each stage as it happens.
 *
 * `reload` runs once a decision exists so a page can re-read whatever the
 * transaction changed -- an assessment that was written, or (for a refusal) the
 * fact that nothing was.
 */
export async function submit(
  session: WalletSession,
  method: string,
  args: CalldataEncodable[],
  onStage: (submission: Submission) => void,
  options: { interval?: number; retries?: number } = {},
): Promise<Submission> {
  let submission: Submission = {
    stage: "signing",
    hash: "",
    status: "",
    result: "",
    execution: "",
    refusal: "",
    detail: "waiting for the wallet to sign",
  };
  onStage(submission);

  let hash: string;
  try {
    hash = await session.client.writeContract({
      address: CONTRACT_ADDRESS,
      functionName: method,
      args,
      value: 0n,
    });
  } catch (error) {
    submission = {
      ...submission,
      stage: "failed",
      detail: describeRefusal(error),
    };
    onStage(submission);
    return submission;
  }

  submission = {
    ...submission,
    stage: "submitted",
    hash,
    detail: "submitted; the validators are reading the documents",
  };
  onStage(submission);

  let receipt: Receipt;
  try {
    receipt = (await session.client.waitForTransactionReceipt({
      hash: hash as Hash,
      interval: options.interval ?? 5000,
      retries: options.retries ?? 120,
    })) as Receipt;
  } catch (error) {
    submission = {
      ...submission,
      stage: "no-decision",
      detail: describeRefusal(error),
    };
    onStage(submission);
    return submission;
  }

  const status = statusOf(receipt);
  const result = resultOf(receipt);
  const execution = executionOf(receipt);
  const refusal = refusalIn(receipt);

  let stage: SubmissionStage = STAGE_STATUS[status] ?? "no-decision";
  if (stage !== "no-decision" && !succeeded(receipt)) stage = "refused";

  submission = {
    stage,
    hash,
    status,
    result,
    execution,
    refusal,
    detail:
      stage === "refused"
        ? refusal || `the round ended ${status} / ${result}`
        : stage === "no-decision"
          ? `the round ended ${status} / ${result}`
          : `the round ended ${status} / ${result}`,
  };
  onStage(submission);
  return submission;
}
