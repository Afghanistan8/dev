// Print what the deployed contract says about itself.
//
// A one-line liveness check for the address in .dev-deploy.json: it reads
// get_protocol_info, which is a view and costs nothing, and repeats the counts,
// rules and limits the contract publishes.

import { connect, readRecord, short } from "./client.mjs";

async function main() {
  const { client, account } = await connect();
  const record = await readRecord();
  const address = process.argv[2] || record.address;
  console.log(`- reading ${address} (${record.source})`);

  const info = await client.readContract({
    account,
    address,
    functionName: "get_protocol_info",
    args: [],
  });

  console.log("");
  console.log(`  rules        ${info.rules}`);
  console.log(`  schema       ${info.schema}`);
  console.log(`  network      ${info.network} on ${info.provider}`);
  console.log(`  verdicts     ${info.verdicts.join(" / ")}`);
  console.log(`  statuses     ${info.finding_statuses.join(" / ")}`);
  console.log(`  specifications ${info.specification_count}`);
  console.log(`  assessments    ${info.assessment_count}`);
  console.log(`  quote words  ${info.quote_words}`);
  console.log(`  limits       ${JSON.stringify(info.limits)}`);
}

main().catch((error) => {
  console.error(`info failed: ${short(error)}`);
  process.exitCode = 1;
});
