import type { Metadata } from "next";
import "@/styles/globals.css";

export const metadata: Metadata = {
  title: "SwiftUI for the Web",
  description:
    "Apple SwiftUI, replicated 1:1 as a TypeScript/React UI kit — reverse-engineered from Apple's authoritative .swiftinterface declarations.",
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  );
}
