# Deployment

Dev is deployed to the **GenLayer Studio Network** (`studionet`, chain id `61999`). This document is
how it was built, how to reproduce it, and how to check the deployed code is the code in this
repository.

## The live instance

| | |
| --- | --- |
| Address | `0x605c579967C64B9b086B0Cf26ABb154Bc472f625` |
| Explorer | <https://explorer-studio.genlayer.com/address/0x605c579967C64B9b086B0Cf26ABb154Bc472f625> |
| Deploy transaction | `0x1694a0393c99fb9c7469a12b5b9c6baf0dac6f2a588ccba6f69a1adcb95b2ee5` |
| Deployer | `0x4184bc5E5444F250767E8D33A49817A9B4FB0df3` |
| Runner pin | `py-genlayer:1jb45aa8ynh2a9c9xn3b7qqh8sm5q93hwfp7jqmwsfhh8jpz09h6` |

These values are written by the scripts, not typed by hand: the deploy script writes
[`.dev-deploy.json`](../.dev-deploy.json), the end-to-end run writes
[`live-report.json`](../deploy/live-report.json).

## The runner pin

The first line of `contracts/dev.py` is a comment the deployment tool reads:

```python
# { "Depends": "py-genlayer:1jb45aa8ynh2a9c9xn3b7qqh8sm5q93hwfp7jqmwsfhh8jpz09h6" }
```

**It must be a concrete hash.** Dev targets the legacy runtime, where the contract base is
`gl.Contract` and the runtime namespace is `genlayer.gl` — that is what the pinned runner provides,
and what the deployed contract was built and tested against (`contracts/dev.py` imports
`from genlayer import *` and subclasses `gl.Contract`). `py-genlayer:test` and `py-genlayer:latest`
are rejected by the networks, and aliases would make the deployed code unauditable, so
`scripts/deploy.mjs` refuses to send a contract whose pin is an alias and prints the pin it used.

## Reproducing the deployment

```bash
# a funded account on Studionet, exported for the shell only
export DEV_PRIVATE_KEY=0x...

# deploy, check the source compiles, write .dev-deploy.json
npm run deploy

# the printed address goes into the console's environment
#   NEXT_PUBLIC_DEV_CONTRACT=0x...
#   NEXT_PUBLIC_DEV_CHAIN_ID=61999
#   NEXT_PUBLIC_DEV_RPC=https://studio.genlayer.com/api
```

`npm run deploy` does three things before it sends anything:

1. refuses a contract whose pin is missing or an alias;
2. calls `getContractSchemaForCode(source)` so a contract that would not compile fails for free,
   and prints the number of entry points;
3. deploys, then verifies the address by reading a view back, retrying a few times — a deploy is
   only reported as successful once the contract answers.

Other networks are selected with `DEV_NETWORK` (`studionet`, `testnet-asimov`,
`testnet-bradbury`, `localnet`) or pointed at explicitly with `DEV_RPC` and `DEV_CHAIN_ID`. An
unknown chain id is refused rather than guessed, because the SDK's chain definition carries the
consensus and fee contract addresses, and inventing one produces a client that fails *after*
signing with "consensus main contract address not found".

## Checking the deployed code

```bash
npm run schema
```

`scripts/schema.mjs` reads the schema for the code in this repository, reads the schema of the
deployed address back off the chain, and compares them:

- every expected entry point (4 writes, 12 views) must be present;
- no entry point may be named like a privileged surface (`owner`, `admin`, `upgrade`, `pause`,
  `withdraw`, …);
- if the source on disk declares an entry point the deployed contract does not, it says so — that
  is the signal to redeploy before trusting the address.

It exits non-zero if any of those fail, so it can be a gate.

```bash
node -e "import('./scripts/client.mjs').then(async ({connect,readRecord})=>{ \
  const {client}=await connect(); const {address}=await readRecord(); \
  const code=await client.getContractCode(address); console.log(code.length,'bytes'); })"
```

`getContractCode(address)` returns the source the network is actually running, so the deployed bytes
can be hashed and compared against `contracts/dev.py` in this repository.

## Linting before you deploy

```bash
npm run lint      # genvm-lint lint contracts/dev.py
```

This is the contract quality gate and it passes cleanly (`✓ Lint passed (3 checks)`). It is run on
the file on disk, so a contract that would be rejected at runtime for a lint reason is caught here
rather than in a transaction that costs gas.

> Note: `genvm-lint validate` currently fails with `E101` on this toolchain regardless of the
> contract, so `lint` is the gate that is used and quoted. On Windows, run it with
> `PYTHONIOENCODING=utf-8` set, and make sure the linter is on `PATH` — with the Python 3.14
> install used here that is
> `C:\Users\<you>\AppData\Local\Python\pythoncore-3.14-64\Scripts\genvm-lint.exe`
> (`npm run lint` assumes it is on `PATH`; the direct path also works).

## Driving the deployment

```bash
DEV_PRIVATE_KEY=0x... npm run live                    # every transition, on the network
npm run verify -- S1 A1                               # recompute a record's digests
npm run verify -- S1                                  # just the criteria and baseline
```

See [END-TO-END.md](END-TO-END.md) for what the live run does and what it records.

## The console

The console needs no server of its own; it is a static-plus-dynamic Next.js app that talks to the
RPC in the browser.

```bash
cd web
cp .env.example .env.local     # put the deployed address in NEXT_PUBLIC_DEV_CONTRACT
npm install
npm run build && npm start     # or: npm run dev
```

Nothing in `.env.local` is a secret. All three values are public addresses and endpoints, compiled
into the browser bundle on purpose; the console holds no key and has no backend.

### Wallet

Any EIP-1193 wallet works. The console builds a `genlayer-js` client with the connected address and
the injected provider, so `eth_sendTransaction` goes to the wallet and Dev never sees a private key.
Connecting on the wrong chain shows a switch control rather than failing at signing time; a visitor
with no wallet can read every page and is told why they cannot write.

## Cost

Each assessment is one transaction that runs a multi-validator reading round, so it is the
expensive operation; registering, adding requirements and freezing are cheap string writes. The live
run in `docs/END-TO-END.md` records the transaction ids and the round outcomes for a full pass.

## Rollback

There is none, deliberately. The contract has no owner, no admin and no upgrade path, so a deployed
instance cannot be changed — a new deployment is a new address, and the old one keeps its record
intact.
