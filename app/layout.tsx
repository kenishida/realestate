import type { Metadata } from "next";
import { Asap_Condensed } from "next/font/google";
import "./globals.css";
import { AuthProvider } from "@/lib/auth-context";
import AppShell from "@/components/AppShell";

// Asap Condensedフォントの読み込み
const customFont = Asap_Condensed({
  weight: ["400", "500", "600", "700"],
  subsets: ["latin"],
  variable: "--font-custom",
  display: "swap",
});

export const metadata: Metadata = {
  title: "物件価値わかるくん",
  description: "物件URLを入力して投資判断を取得",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="ja" className={customFont.variable}>
      <body className="antialiased">
        <AuthProvider>
          <AppShell>{children}</AppShell>
        </AuthProvider>
      </body>
    </html>
  );
}
