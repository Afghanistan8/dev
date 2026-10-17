// Read the deployed contract's schema back off the chain.
//
// Worth running straight after a deploy: it is the cheapest proof that the
// contract compiled, that its public surface is what you meant to ship, and that
// the address in .dev-deploy.json is the one carrying it.

import { connect, contractSource, readRecord, short } from "./client.mjs";

const WRITES = [
  "register_specification",
  "add_requirement",
  "freeze_specification",
  "submit_assessment",
];

const VIEWS = [
  "get_protocol_info",
  "get_specification",
  "get_criteria",
  "get_baseline",
  "get_requirements",
  "list_specifications",
  "list_by_creator",
  "get_assessment",
  "get_proposed",
  "get_findings",
  "list_assessments",
  "list_specification_assessments",
];

const EXPECTED = [...WRITES, ...VIEWS];

// A ContractSchema is { ctor, methods }. Only `methods` is the public surface;
// `ctor` describes the constructor's own parameters.
function methodNames(schema) {
  const methods = schema?.methods;
  if (!methods || typeof methods !== "object") return [];
  return Object.keys(methods).sort();
}

// The contract must have no owner, admin or upgrade path. These are the names a
// privileged surface would wear, and their presence would be the finding.
const FORBIDDEN = ["owner", "admin", "upgrade", "set_owner", "transfer_ownership",
                   "pause", "unpause", "withdraw", "selfdestruct", "destroy"];

async function main() {
  const { client } = await connect({ signer: false });

  const local = await client.getContractSchemaForCode(await contractSource());
  const fromSource = methodNames(local);
  console.log(`- source declares ${fromSource.length} entry points`);

  let fromChain = null;
  try {
    const record = await readRecord();
    console.log(`- reading ${record.address} (${record.source})`);
    fromChain = methodNames(await client.getContractSchema(record.address));
    console.log(`- deployed contract declares ${fromChain.length} entry points`);
  } catch (error) {
    console.log(`! no deployed schema to compare: ${short(error)}`);
  }

  const names = fromChain ?? fromSource;
  const missing = EXPECTED.filter((name) => !names.includes(name));
  const privileged = names.filter((name) => FORBIDDEN.includes(name.toLowerCase()));
  const ok = missing.length === 0 && privileged.length === 0;

  console.log("");
  for (const name of names) console.log(`  ${name}`);
  console.log("");

  if (missing.length) console.error(`missing entry points: ${missing.join(", ")}`);
  if (privileged.length) console.error(`privileged entry points present: ${privileged.join(", ")}`);
  if (!ok) {
    process.exitCode = 1;
    return;
  }
  if (fromChain) {
    const drift = fromSource.filter((name) => !fromChain.includes(name));
    if (drift.length) {
      console.log(
        `! the source on disk has entry points the deployed contract does not: ` +
          `${drift.join(", ")} -- redeploy before trusting the address`,
      );
    }
  }
  console.log("schema read back; every expected entry point is present and none is privileged.");
}

main().catch((error) => {
  console.error(`schema read failed: ${error.message}`);
  process.exitCode = 1;
});
