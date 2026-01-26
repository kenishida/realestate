import type { Metadata } from "next";
import { Asap_Condensed } from "next/font/google";
import "./globals.css";

// Asap Condensedフォントの読み込み
const customFont = Asap_Condensed({
  weight: ["400", "500", "600", "700"],
  subsets: ["latin"],
  variable: "--font-custom",
  display: "swap",
});

export const metadata: Metadata = {
  title: "Real Estate",
  description: "Real Estate Application",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="ja" className={customFont.variable}>
      <body className="antialiased">
        <main>
          {children}
        </main>
      </body>
    </html>
  );
}
