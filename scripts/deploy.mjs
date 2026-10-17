// Deploy the Dev contract and record where it landed.
//
//   DEV_PRIVATE_KEY=0x... npm run deploy          # Studionet only, chain 61999

import { createHash } from "node:crypto";

import { connect, contractSource, deploy, writeRecord } from "./client.mjs";

async function main() {
  const { client, target, account } = await connect();
  const code = await contractSource();

  const pin = code.split("\n", 1)[0];
  if (!pin.includes("py-genlayer:")) {
    throw new Error(
      "contracts/dev.py must start with its runner pin, e.g. " +
        '# { "Depends": "py-genlayer:<hash>" }',
    );
  }
  if (/py-genlayer:(test|latest)\b/.test(pin)) {
    throw new Error(
      `the runner pin is an alias (${pin.trim()}); the networks reject ` +
        "py-genlayer:test and py-genlayer:latest. Pin a concrete runner hash.",
    );
  }
  console.log(`- runner ${pin.trim()}`);

  // The schema for the source on disk, before anything is sent: it costs
  // nothing and it fails on a contract that would not compile.
  const schema = await client.getContractSchemaForCode(code);
  const surface = Object.keys(schema?.methods ?? {});
  if (surface.length === 0) {
    throw new Error("the contract declares no public methods; nothing to deploy");
  }
  console.log(`- source compiles, ${surface.length} entry points`);

  const { hash, address } = await deploy(client, code, []);

  console.log(`- Dev is at ${address}`);
  if (target.explorer) {
    console.log(`- ${target.explorer}/address/${address}`);
  }
  await writeRecord({
    address,
    chainId: target.id,
    network: target.key,
    rpc: target.rpc,
    deployer: account.address,
    deployedAt: new Date().toISOString(),
    transaction: hash,
    runner: pin.trim(),
    sourceSha256: createHash("sha256").update(code).digest("hex"),
    explorer: target.explorer ? `${target.explorer}/address/${address}` : "",
  });

  console.log("");
  console.log("Point the app at it:");
  console.log(`  NEXT_PUBLIC_DEV_CONTRACT=${address}`);
  console.log(`  NEXT_PUBLIC_DEV_CHAIN_ID=${target.id}`);
  console.log(`  NEXT_PUBLIC_DEV_RPC=${target.rpc}`);
  console.log("");
  console.log("Then: npm run schema && npm run live");
}

main().catch((error) => {
  console.error(`deploy failed: ${error.message}`);
  process.exitCode = 1;
});
