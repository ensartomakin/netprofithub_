import type { Metadata } from "next";
import "./globals.css";
import { Providers } from "./providers";
import type { ReactNode } from "react";
import { AuthGate } from "@/components/app/auth-gate";

export const metadata: Metadata = {
  title: "NetProfitHub",
  description: "E-ticaret kârlılık ve envanter zekâsı",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: ReactNode;
}>) {
  return (
    <html lang="tr" className="h-full antialiased" suppressHydrationWarning>
      <body className="min-h-full flex flex-col">
        <Providers>
          <AuthGate>{children}</AuthGate>
        </Providers>
      </body>
    </html>
  );
}
