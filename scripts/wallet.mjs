// Get a signing key for the scripts, without inventing one.
//
// The GenLayer CLI keeps its accounts in an encrypted keystore and caches the
// private key of an unlocked account in the OS keychain. This reads that cached
// key, checks it derives the address on record, and writes it to `.env` so the
// deploy, live and verify scripts can sign as the same wallet the CLI does.
//
//   genlayer account unlock --account deployer
//   node scripts/wallet.mjs                 # writes .env
//   node scripts/wallet.mjs --print         # also prints the key
//
// `.env` is gitigneored. Nothing here leaves this machine.

import { createRequire } from "node:module";
import { writeFileSync, existsSync } from "node:fs";
import { resolve } from "node:path";

import { createAccount, generatePrivateKey } from "genlayer-js";
import { ROOT } from "./client.mjs";

const CLI = process.env.GENLAYER_CLI_DIR ||
  "C:/Users/emman/AppData/Roaming/npm/node_modules/genlayer";
const ACCOUNT = process.env.DEV_CLI_ACCOUNT || (process.argv.includes("--account")
  ? process.argv[process.argv.indexOf("--account") + 1]
  : "deployer");

async function fromKeychain() {
  const require = createRequire(`${CLI}/`);
  let keytar;
  try {
    keytar = require("keytar");
  } catch {
    return null;
  }
  return keytar.getPassword("genlayer-cli", `account:${ACCOUNT}`);
}

async function main() {
  let privateKey = await fromKeychain();
  let source = `the OS keychain (CLI account "${ACCOUNT}")`;
  if (!privateKey) {
    privateKey = generatePrivateKey();
    source = "a freshly generated key (fund it before writing)";
  }
  if (!privateKey.startsWith("0x")) privateKey = `0x${privateKey}`;

  const account = createAccount(privateKey);
  const envPath = resolve(ROOT, ".env");
  const line = `DEV_PRIVATE_KEY=${privateKey}\n`;
  writeFileSync(envPath, line, "utf8");

  console.log(`- signing key from ${source}`);
  console.log(`- address ${account.address}`);
  if (existsSync(envPath)) console.log(`- wrote ${envPath}`);
  if (process.argv.includes("--print")) console.log(`- DEV_PRIVATE_KEY=${privateKey}`);
  else console.log("- the key is in .env; pass --print to see it");
}

main().catch((error) => {
  console.error(error.message);
  process.exitCode = 1;
});
