import type { Metadata } from "next";

import { Shell } from "@/components/Shell";
import { WalletProvider } from "@/components/Wallet";

import "./globals.css";

export const metadata: Metadata = {
  title: "Dev — is this change compatible with what was frozen?",
  description:
    "A specification and the requirements it must keep are frozen on chain. " +
    "Anyone may submit a new version. Independent validators read both and " +
    "answer, requirement by requirement, whether it still holds. Deterministic " +
    "code turns the answers into COMPATIBLE, BREAKING CHANGE or INCONCLUSIVE.",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body>
        <WalletProvider>
          <Shell>{children}</Shell>
        </WalletProvider>
      </body>
    </html>
  );
}
