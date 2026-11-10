import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: {
    default: "Vornokia AI — One intelligence. Every platform.",
    template: "%s · Vornokia AI",
  },
  description:
    "A thoughtful space to bring your ideas together, find momentum, and move forward with intention.",
};

export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  );
}
