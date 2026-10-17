import assert from "node:assert/strict";
import test from "node:test";

import { refuseAlternateConfiguration } from "../scripts/chain.mjs";

test("the stable Studionet configuration is accepted", () => {
  assert.doesNotThrow(() => refuseAlternateConfiguration({}));
  assert.doesNotThrow(() =>
    refuseAlternateConfiguration({
      DEV_NETWORK: "studionet",
      DEV_CHAIN_ID: "61999",
      DEV_RPC: "https://studio.genlayer.com/api",
    }),
  );
});

for (const [name, environment] of [
  ["an alternate named network", { DEV_NETWORK: "testnet-asimov" }],
  ["an alternate chain id", { DEV_CHAIN_ID: "4212" }],
  ["an alternate RPC endpoint", { DEV_RPC: "http://127.0.0.1:4000/api" }],
]) {
  test(`Dev refuses ${name}`, () => {
    assert.throws(() => refuseAlternateConfiguration(environment), /refused/);
  });
}
