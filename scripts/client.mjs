// A client, an account, settlement, and the deployment record.
//
// genlayer-js resolves the fee policy and the nonce inside `writeContract`, so a
// caller no longer estimates and attaches a fee deposit by hand: the SDK builds
// the ADD_TRANSACTION calldata, signs it against the chain's consensus contract
// and returns the transaction id. What is left for us is the part consensus
// itself does not answer -- whether the transaction that finalised actually
// executed, or reverted in the contract.
//
// A Studio transaction is `ACCEPTED` when the validators have reached a result
// and `MAJORITY_AGREE` when they agreed about it. Neither says the contract
// returned. The leader receipt does: `execution_result` is `SUCCESS` when the
// method returned and `ERROR` when it raised, and on an error its `result`
// carries the `[CODE] message` a refusal wears. So a write is a success only
// when it is decided, agreed, and the leader did not error -- three separate
// facts read from three separate fields.

import { readFile, writeFile } from "node:fs/promises";
import { existsSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";

import { createAccount, createClient, generatePrivateKey } from "genlayer-js";

import { resolveTarget } from "./chain.mjs";

export const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), "..");
export const CONTRACT_PATH = resolve(ROOT, "contracts/dev.py");
export const RECORD_PATH = resolve(ROOT, ".dev-deploy.json");

// Transaction statuses and results, from the SDK's own enums. Named here so the
// checks below read as sentences rather than as magic numbers.
const ACCEPTED = 5;
const FINALIZED = 7;
const MAJORITY_AGREE = 6;

// A decision takes as long as a consensus round plus whatever the queue is
// doing, which is measured in minutes, not in the SDK's default thirty seconds.
// Each `waitForTransactionReceipt` call polls for ten minutes; if it times out
// or the RPC errors, the loop starts another one until the overall deadline.
const POLL = { interval: 5000, retries: 120 };
const DEADLINE_MS = 30 * 60 * 1000;

const sleep = (ms) => new Promise((done) => setTimeout(done, ms));


// A key written by `node scripts/wallet.mjs` lives in .env. Load it only when
// nothing on the command line already named one, so an explicit environment
// variable always wins.
if (!process.env.DEV_PRIVATE_KEY) {
  const envPath = resolve(ROOT, ".env");
  if (existsSync(envPath) && typeof process.loadEnvFile === "function") {
    try {
      process.loadEnvFile(envPath);
    } catch {
      // a malformed .env is not worth refusing to run over
    }
  }
}

export async function contractSource() {
  return readFile(CONTRACT_PATH, "utf8");
}

/** The signer. A generated key is printed, because an unprinted key is lost. */
export function account() {
  const given = process.env.DEV_PRIVATE_KEY;
  if (given) return createAccount(given.startsWith("0x") ? given : `0x${given}`);
  const made = generatePrivateKey();
  console.log(`! no DEV_PRIVATE_KEY set, using a fresh key: ${made}`);
  console.log("! fund it in Studio, or set DEV_PRIVATE_KEY to one you own.");
  return createAccount(made);
}

/** A throwaway signer, for proving that an account is not allowed to act. */
export function stranger() {
  return createAccount(generatePrivateKey());
}

export async function connect() {
  const { target, fellBack, insteadOf } = await resolveTarget();
  if (fellBack) {
    console.log(`! ${insteadOf.name} did not answer; using ${target.name}`);
  }
  const signer = account();
  const client = createClient({
    chain: target.chain,
    endpoint: target.rpc,
    account: signer,
  });
  console.log(`- ${target.name} (chain ${target.id}) at ${target.rpc}`);
  console.log(`- signing as ${signer.address}`);
  return { client, target, account: signer };
}

// -- reading a receipt --------------------------------------------------------

/** The status a receipt is in: `ACCEPTED`, `FINALIZED`, `UNDETERMINED`, ... */
function statusOf(transaction) {
  return transaction?.status_name ?? transaction?.statusName ??
    (typeof transaction?.status === "number" ? String(transaction.status) : "unknown");
}

/** The consensus result: `MAJORITY_AGREE`, `NO_MAJORITY`, `MAJORITY_DISAGREE`, ... */
function resultOf(transaction) {
  return transaction?.result_name ?? transaction?.resultName ??
    (transaction?.result === MAJORITY_AGREE ? "MAJORITY_AGREE" : String(transaction?.result ?? "unknown"));
}

function leaderOf(transaction) {
  const receipts = transaction?.consensus_data?.leader_receipt;
  if (Array.isArray(receipts)) return receipts[0] ?? null;
  return receipts ?? null;
}

/** `SUCCESS` when the leader's method returned, `ERROR` when it raised. */
function executionOf(transaction) {
  return leaderOf(transaction)?.execution_result ?? "unknown";
}

/** Whether consensus actually decided and the contract actually ran. */
export function succeeded(transaction) {
  const status = statusOf(transaction);
  const decided = status === "ACCEPTED" || status === "FINALIZED" ||
    transaction?.status === ACCEPTED || transaction?.status === FINALIZED;
  return decided && resultOf(transaction) === "MAJORITY_AGREE" &&
    executionOf(transaction) !== "ERROR";
}

/**
 * Wait for a decision, tolerating both the SDK's per-call timeout and transient
 * RPC failures. Returns the receipt; it does not judge it.
 */
async function waitFor(client, hash, label) {
  const deadline = Date.now() + DEADLINE_MS;
  let lastError;
  for (;;) {
    try {
      return await client.waitForTransactionReceipt({ hash, ...POLL });
    } catch (error) {
      lastError = error;
    }
    if (Date.now() > deadline) {
      throw new Error(
        `${label}: no decision for ${hash} within ${DEADLINE_MS / 60000} minutes` +
          (lastError ? ` (${short(lastError)})` : ""),
      );
    }
    await sleep(5000);
  }
}

/**
 * Wait for a decision, then say plainly whether the execution succeeded.
 * Consensus deciding and the contract not reverting are separate facts.
 */
export async function settle(client, hash, label) {
  const transaction = await waitFor(client, hash, label);
  const status = statusOf(transaction);
  const result = resultOf(transaction);
  const execution = executionOf(transaction);

  if (!succeeded(transaction)) {
    const refusal = refusalIn(transaction);
    throw new Error(
      `${label} did not settle: ${status} / ${result} / ${execution}` +
        (refusal ? `\n    ${refusal}` : ""),
    );
  }
  console.log(`  ${label}: ${status} / ${result}`);
  return transaction;
}

/**
 * Dev's own refusals read as `[CODE] what is wrong`. Dig one out of a receipt so
 * a failed call says why rather than just that it failed. On a contract error
 * the leader receipt's `result` carries `{ status: "rollback", payload: ... }`
 * and the payload is the message the contract raised.
 */
export function refusalIn(transaction) {
  const leader = leaderOf(transaction);
  const raw = leader?.result;
  const payload = raw && typeof raw === "object" && !Array.isArray(raw) ? raw.payload : raw;
  const haystack = [
    payload,
    leader?.genvm_result?.stderr,
    leader?.genvm_result?.error_description,
    leader?.error,
  ].filter((part) => typeof part === "string" && part).join(" \n ");
  const code = refusalText(haystack);
  if (code) return code;
  return refusalText(JSON.stringify(transaction ?? {}).slice(0, 4000));
}

function refusalText(text) {
  const found = String(text).match(/\[[A-Z][A-Z_]{2,}\]/g);
  return found ? [...new Set(found)].join(" ") : "";
}

/** One write through the SDK's own signing path. */
export async function write(client, call, label) {
  const hash = await send(client, call, label);
  console.log(`  ${label}: ${hash}`);
  return { hash, transaction: await settle(client, hash, label) };
}

/** Whether an error looks like a transient transport failure, not a refusal. */
function transient(error) {
  const text = String(error?.message ?? error);
  return /RPC error|Unexpected token|fetch failed|ECONNRESET|ECONNREFUSED|socket hang up|network|502|503|504|timeout|timed out/i.test(
    text,
  );
}

/**
 * Submit one write, retrying a transport failure before anything is signed.
 * A contract refusal does not throw here: it comes back as a hash and is read
 * out of the leader receipt, so an error at this point is the network, not the
 * contract, and trying again is safe.
 */
async function send(client, call, label) {
  for (let attempt = 1; ; attempt += 1) {
    try {
      return await client.writeContract({ value: 0n, ...call });
    } catch (error) {
      if (attempt >= 4 || !transient(error)) throw error;
      console.log(`  ${label}: transport failure, retrying (${short(error)})`);
      await sleep(5000);
    }
  }
}

/**
 * Attempt a write that is expected to be refused. Returns the refusal code, or
 * throws if the call unexpectedly succeeded -- a test that expected a door to be
 * locked must fail loudly when it opens.
 */
export async function expectRefused(client, call, label) {
  const hash = await send(client, call, label);
  const transaction = await waitFor(client, hash, label);
  if (succeeded(transaction)) {
    throw new Error(`${label} was accepted, but it should have been refused`);
  }
  const code = refusalIn(transaction);
  console.log(`  ${label}: refused as expected (${code || "no code in the receipt"})`);
  return code;
}

// -- deploying ----------------------------------------------------------------

/**
 * The address a deployment landed at. Studio returns the created contract as
 * the transaction's recipient, and the decoders sometimes expose it under a
 * `contractAddress` field, so both are read rather than assuming one.
 */
function contractAddressIn(transaction) {
  return (
    transaction?.txDataDecoded?.contractAddress ??
    transaction?.data?.contract_address ??
    transaction?.data?.contractAddress ??
    transaction?.contract_address ??
    transaction?.contractAddress ??
    transaction?.to_address ??
    transaction?.recipient ??
    null
  );
}

/**
 * Deploy, and refuse to report an address until the contract answers.
 *
 * Consensus can accept a deployment whose execution reverted -- a bad runner pin
 * does exactly that -- and the receipt still carries a contract address. So the
 * address is read back and `get_protocol_info` is called before this returns.
 * The SDK's schema RPC is also tried, but it is a nicety: the view is the proof.
 */
export async function deploy(client, code, args = []) {
  let hash;
  for (let attempt = 1; ; attempt += 1) {
    try {
      hash = await client.deployContract({ code, args });
      break;
    } catch (error) {
      if (attempt >= 4 || !transient(error)) throw error;
      console.log(`- deploy transport failure, retrying (${short(error)})`);
      await sleep(5000);
    }
  }
  console.log(`- deploy transaction ${hash}`);
  const transaction = await settle(client, hash, "deploy");

  const address = contractAddressIn(transaction);
  if (!address) {
    throw new Error(
      `the receipt carried no contract address: ${JSON.stringify(transaction).slice(0, 400)}`,
    );
  }

  let info;
  let lastError;
  for (let attempt = 1; attempt <= 5; attempt += 1) {
    try {
      info = await client.readContract({
        address,
        functionName: "get_protocol_info",
        args: [],
      });
      lastError = undefined;
      break;
    } catch (error) {
      // The RPC can accept the transaction before it has indexed the contract,
      // which reads as "not found" for a moment. Give it a few tries.
      lastError = error;
      await new Promise((done) => setTimeout(done, 2000));
    }
  }
  if (lastError) {
    throw new Error(
      `${address} was submitted but never answered, so the deployment did not ` +
        `execute: ${short(lastError)}\n` +
        `    A deploy can be accepted at consensus and still have reverted -- check the ` +
        `runner pin against the network's GenVM build.`,
    );
  }
  if (!info?.rules) {
    throw new Error(
      `${address} answered but published no protocol rules; it is not the Dev contract.`,
    );
  }
  return { hash, transaction, address, info };
}

export function short(error) {
  const text = error instanceof Error ? error.message : String(error);
  return text.split("\n")[0].slice(0, 200);
}

export async function readRecord() {
  const given = process.env.DEV_CONTRACT;
  if (given) return { address: given, source: "DEV_CONTRACT" };
  try {
    const held = JSON.parse(await readFile(RECORD_PATH, "utf8"));
    return { ...held, source: RECORD_PATH };
  } catch {
    throw new Error(
      "no deployment found. Run `npm run deploy`, or set DEV_CONTRACT to " +
        "an address already on the network.",
    );
  }
}

export async function writeRecord(record) {
  await writeFile(RECORD_PATH, `${JSON.stringify(record, null, 2)}\n`, "utf8");
  console.log(`- wrote ${RECORD_PATH}`);
}
