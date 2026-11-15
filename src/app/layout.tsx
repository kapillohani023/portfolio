import type { Metadata } from "next";
import { Geist } from "next/font/google";
import { PAGE_BG } from "@/content/stage";
import "./globals.css";

const geistSans = Geist({
  subsets: ["latin"],
});

export const metadata: Metadata = {
  title: "Kapil Lohani",
  description: "Social links that fall, collide, and settle.",
};

export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    <html lang="en" className={`${geistSans.className} h-full antialiased`}>
      <body
        className="h-dvh overflow-hidden overscroll-none text-zinc-900"
        style={{ backgroundColor: PAGE_BG }}
      >
        {children}
      </body>
    </html>
  );
}
