import type { Metadata, Viewport } from "next";
import localFont from "next/font/local";
import "./globals.css";

const atkinson = localFont({
  src: [
    { path: "../../public/fonts/AtkinsonHyperlegible-Regular.ttf", weight: "400", style: "normal" },
    { path: "../../public/fonts/AtkinsonHyperlegible-Bold.ttf", weight: "700", style: "normal" },
  ],
  variable: "--font-atkinson",
  display: "swap",
});

const cinzel = localFont({
  src: [{ path: "../../public/fonts/Cinzel-Bold.ttf", weight: "700", style: "normal" }],
  variable: "--font-cinzel",
  display: "swap",
});

export const metadata: Metadata = {
  title: { default: "Pharmasee", template: "%s · Pharmasee" },
  description: "Pharmasee: Argos calls your loved one at medication time, checks the bottle on camera, and tells you how it went.",
};

export const viewport: Viewport = {
  themeColor: "#f3e9d2",
  width: "device-width",
  initialScale: 1,
};

export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    <html lang="en" className={`${atkinson.variable} ${cinzel.variable} h-full`}>
      <body className="min-h-full flex flex-col">{children}</body>
    </html>
  );
}
