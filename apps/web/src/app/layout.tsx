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
    <html lang="en" suppressHydrationWarning>
      <head>
        <script
          dangerouslySetInnerHTML={{
            __html: `try{var t=localStorage.getItem("vornokia.theme");document.documentElement.dataset.theme=t==="light"||t==="dark"?t:matchMedia("(prefers-color-scheme: dark)").matches?"dark":"light"}catch{document.documentElement.dataset.theme=matchMedia("(prefers-color-scheme: dark)").matches?"dark":"light"}`,
          }}
        />
      </head>
      <body>{children}</body>
    </html>
  );
}
