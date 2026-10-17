"use client";

import Link from "next/link";

import { CONTRACT_ADDRESS, CONTRACT_SET, NETWORK_NAME } from "@/lib/chain";
import { shortAddress } from "@/lib/format";

import { Mark } from "./Mark";
import { WalletBar } from "./Wallet";

const NAV = [
  { href: "/specs", label: "Specifications" },
  { href: "/new", label: "Register" },
  { href: "/verify", label: "Verify" },
];

export function Shell({ children }: { children: React.ReactNode }) {
  return (
    <div className="min-h-dvh flex flex-col">
      <header className="border-b border-rule">
        <div className="mx-auto w-full max-w-6xl px-4 sm:px-6">
          <div className="flex flex-wrap items-center gap-x-6 gap-y-3 py-4">
            <Link href="/" className="flex items-center gap-2.5 text-bone">
              <span className="text-seal">
                <Mark />
              </span>
              <span className="display text-[1.3rem]">Dev</span>
            </Link>

            <nav className="flex items-center gap-5">
              {NAV.map((item) => (
                <Link key={item.href} href={item.href} className="marginal hover:text-seal">
                  {item.label}
                </Link>
              ))}
            </nav>

            <div className="ml-auto flex items-center gap-4">
              <span className="marginal">{NETWORK_NAME}</span>
              <span className="tabular text-bone-ghost" title={CONTRACT_ADDRESS}>
                {CONTRACT_SET ? shortAddress(CONTRACT_ADDRESS) : "not deployed"}
              </span>
              <WalletBar />
            </div>
          </div>
        </div>
      </header>

      <main className="flex-1">{children}</main>

      <footer className="mt-20 border-t border-rule">
        <div className="mx-auto w-full max-w-6xl px-4 py-8 sm:px-6">
          <p className="measure text-sm text-bone-faint">
            Freeze the requirement. Submit the change. Validators read both.
            Code records the verdict.
          </p>
          <p className="marginal mt-4">
            A verdict stands on requirements that were frozen before the change
            was proposed, and on a panel that read the documents separately. No
            party — author, operator or model — can certify its own change.
          </p>
        </div>
      </footer>
    </div>
  );
}
