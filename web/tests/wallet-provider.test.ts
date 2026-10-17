import { describe, expect, it } from "vitest";

import { injectedProviders, isEip1193Provider } from "@/lib/wallet-provider";

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
});
