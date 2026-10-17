// Verify a record from the chain, without trusting any of it.
//
//   npm run verify -- <specification-id> [assessment-id]
//   DEV_CONTRACT=0x... npm run verify -- S1 A1
//
// Everything printed here is recomputed from the bytes the contract stores, on
// this machine, and compared with the digests the contract published. If the two
// agree, the record the contract is showing is the record those bytes produce.
// If they do not, the contract and this client disagree about the same input and
// the disagreement is the finding.

import { connect, readRecord, short } from "./client.mjs";
import { criteriaDigest, decisiveDigest, baselineHash } from "./canon.mjs";

function agree(label, a, b) {
  const same = a === b;
  console.log(`  ${same ? "ok " : "!  "}${label}`);
  console.log(`      chain ${a}`);
  if (!same) console.log(`      local ${b}`);
  return same;
}

async function main() {
  const specId = process.argv[2];
  const assessmentId = process.argv[3];
  if (!specId) {
    console.error("usage: npm run verify -- <specification-id> [assessment-id]");
    process.exitCode = 1;
    return;
  }

  const { client, account } = await connect();
  const record = await readRecord();
  const address = record.address;
  console.log(`- verifying ${address} (${record.source})`);

  const view = await client.readContract({
    account, address, functionName: "get_criteria", args: [specId],
  });
  const baseline = await client.readContract({
    account, address, functionName: "get_baseline", args: [specId],
  });

  console.log(`\nspecification ${specId}  rules ${view.rules}`);
  console.log(`  ${view.requirements.length} frozen requirement(s), frozen=${view.frozen}`);
  console.log(`  baseline ${baseline.baseline_version} hashes to ` +
    `${(await baselineHash(baseline.content)).slice(0, 16)}… (stored ${baseline.baseline_hash.slice(0, 16)}…)`);

  let ok = true;
  ok = agree("the stored baseline hash covers the stored baseline bytes",
             baseline.baseline_hash, await baselineHash(baseline.content)) && ok;
  ok = agree("the frozen criteria digest matches the requirements",
             view.criteria_digest,
             await criteriaDigest(baseline.baseline_hash, view.requirements, view.rules)) && ok;

  if (assessmentId) {
    const found = await client.readContract({
      account, address, functionName: "get_findings", args: [assessmentId],
    });
    const proposed = await client.readContract({
      account, address, functionName: "get_proposed", args: [assessmentId],
    });
    console.log(`\nassessment ${assessmentId}  verdict ${found.verdict}`);
    console.log(`  ${found.summary}`);
    ok = agree("the assessment points at this specification's criteria",
               found.criteria_digest, view.criteria_digest) && ok;
    ok = agree("the proposed digest covers the proposed bytes",
               proposed.proposed_hash, await baselineHash(proposed.content)) && ok;
    ok = agree("the decisive digest matches the findings the contract stores",
               found.decisive_digest, await decisiveDigest(found.items)) && ok;

    console.log("");
    for (const item of found.items) {
      const note = item.held_for_grounding
        ? `held (answered ${item.status})`
        : item.effective_status;
      console.log(`  ${item.requirement_id}  ${note}  grounded_in=[${item.grounded_in.join(", ")}]`);
      const excerpt = String(item.evidence ?? "").replace(/\s+/g, " ").slice(0, 90);
      if (excerpt) console.log(`      "${excerpt}"`);
    }
    if (found.injection_signals?.length) {
      console.log(`  injection signals: ${found.injection_signals.map((s) => s.signal).join(", ")}`);
    }
  }

  console.log("");
  if (ok) {
    console.log("every digest recomputed here matches the one the contract published.");
  } else {
    console.log("a digest does not match. The record and its bytes disagree.");
    process.exitCode = 1;
  }
}

main().catch((error) => {
  console.error(`verify failed: ${short(error)}`);
  process.exitCode = 1;
});
