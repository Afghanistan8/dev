import { describe, expect, it } from "vitest";

import {
  announcedWalletCandidate,
  injectedProviders,
  isEip1193Provider,
  legacyWalletCandidates,
  mergeWalletCandidates,
} from "@/lib/wallet-provider";

const provider = () => ({ request: async () => [] });

describe("wallet provider discovery", () => {
  it("accepts a normal EIP-1193 injection", () => {
    const wallet = provider();
    expect(isEip1193Provider(wallet)).toBe(true);
    expect(injectedProviders({ ethereum: wallet })).toEqual([wallet]);
  });

  it("discovers legacy multi-wallet injections once each", () => {
    const first = provider();
    const second = provider();
    const root = { ...first, providers: [first, second, first, { request: "not callable" }] };
    expect(injectedProviders({ ethereum: root })).toEqual([first, second, root]);
  });

  it("does not mistake arbitrary page data for a wallet", () => {
    expect(injectedProviders({ ethereum: { request: "send" } })).toEqual([]);
    expect(injectedProviders({})).toEqual([]);
  });

  it("labels legacy providers and preserves the EIP-6963 wallet name", () => {
    const keplr = { ...provider(), isKeplr: true };
    const fallback = legacyWalletCandidates({ ethereum: keplr });
    const announced = announcedWalletCandidate({
      provider: keplr,
      info: { uuid: "keplr-uuid", name: "Keplr Extension", icon: "data:image/svg+xml,test" },
    });
    expect(fallback[0]?.name).toBe("Keplr");
    expect(announced).toMatchObject({ id: "keplr-uuid", name: "Keplr Extension" });
    expect(mergeWalletCandidates(fallback, announced ? [announced] : [])).toEqual([
      expect.objectContaining({ name: "Keplr Extension", id: "keplr-uuid" }),
    ]);
  });

  it("rejects malformed EIP-6963 announcements", () => {
    expect(announcedWalletCandidate({ provider: { request: "no" } })).toBeNull();
    expect(announcedWalletCandidate(null)).toBeNull();
  });
});
