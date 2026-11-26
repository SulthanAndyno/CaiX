import type { Metadata } from "next";
import { Inter, Space_Grotesk } from "next/font/google";
import { Providers } from "@/components/Providers";
import "./globals.css";

const inter = Inter({
  variable: "--font-inter",
  subsets: ["latin"],
  display: "swap",
});

const spaceGrotesk = Space_Grotesk({
  variable: "--font-space-grotesk",
  subsets: ["latin"],
  display: "swap",
});

export const metadata: Metadata = {
  title: "CaiX — Peta Konsep & Kuis dari PDF Kuliah",
  description:
    "Connected Knowledge Paths for Smarter Learning: ubah slide atau modul PDF menjadi peta konsep interaktif dan kuis yang tertaut ke halaman sumber.",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html
      lang="id"
      className={`${inter.variable} ${spaceGrotesk.variable} h-full`}
    >
      <body className="min-h-full bg-[#F6F8FC] text-[#0B1F4B] antialiased">
        <Providers>{children}</Providers>
      </body>
    </html>
  );
}
