"use client";

import { useState } from "react";
import { usePathname } from "next/navigation";
import AppVerticalSidebar from "@/components/AppVerticalSidebar";
import { useAuth } from "@/lib/auth-context";

export default function AppShell({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const [homeResetKey, setHomeResetKey] = useState(0);
  const { user, signOut, isLoading: authLoading } = useAuth();

  const handleHomeClick = () => {
    if (pathname === "/") setHomeResetKey((k) => k + 1);
  };

  const mainKey = pathname === "/" ? `home-${homeResetKey}` : (pathname ?? "/");

  return (
    <div className="flex h-screen bg-gray-50">
      <AppVerticalSidebar onHomeClick={handleHomeClick} />
      <div className="flex min-w-0 flex-1 flex-col">
        <header className="flex h-16 shrink-0 items-center justify-end border-b border-gray-200 bg-white px-6">
          {!authLoading && user && (
            <div className="flex items-center gap-2">
              <span
                className="max-w-[180px] truncate text-sm text-gray-600"
                title={user.email ?? undefined}
              >
                {user.email}
              </span>
              <button
                type="button"
                onClick={() => signOut()}
                className="rounded-lg border border-gray-300 px-3 py-1.5 text-sm font-medium text-gray-700 hover:bg-gray-50"
              >
                ログアウト
              </button>
            </div>
          )}
        </header>
        <main key={mainKey} className="flex min-h-0 flex-1 flex-col overflow-y-auto">
          {children}
        </main>
      </div>
    </div>
  );
}
