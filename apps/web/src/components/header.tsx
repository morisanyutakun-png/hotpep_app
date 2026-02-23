"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useAuth } from "@/lib/auth";
import { Button } from "@/components/ui/button";

export function Header() {
  const { user, role, logout } = useAuth();
  const router = useRouter();

  if (!user) return null;

  return (
    <header className="sticky top-0 z-50 bg-white/80 backdrop-blur-md border-b">
      <div className="max-w-7xl mx-auto px-4 h-14 flex items-center justify-between">
        <div className="flex items-center gap-6">
          <Link href="/" className="flex items-center gap-2">
            <div className="w-8 h-8 bg-orange-500 rounded-lg flex items-center justify-center">
              <span className="text-white text-sm font-bold">H</span>
            </div>
            <span className="font-bold text-lg hidden sm:inline">HotPep</span>
          </Link>

          <nav className="flex items-center gap-1 text-sm">
            <Link
              href="/"
              className="px-3 py-1.5 rounded-md hover:bg-orange-50 text-gray-700 hover:text-orange-600 transition-colors"
            >
              スペース一覧
            </Link>
            <Link
              href="/my-reservations"
              className="px-3 py-1.5 rounded-md hover:bg-orange-50 text-gray-700 hover:text-orange-600 transition-colors"
            >
              マイ予約
            </Link>
            {role === "admin" && (
              <Link
                href="/admin"
                className="px-3 py-1.5 rounded-md hover:bg-orange-50 text-gray-700 hover:text-orange-600 transition-colors"
              >
                管理画面
              </Link>
            )}
          </nav>
        </div>

        <div className="flex items-center gap-3">
          <span className="text-sm text-muted-foreground hidden sm:inline">
            {user.display_name}
          </span>
          {role === "admin" && (
            <span className="text-xs bg-orange-100 text-orange-700 px-2 py-0.5 rounded-full font-medium">
              管理者
            </span>
          )}
          <Button
            variant="ghost"
            size="sm"
            onClick={() => {
              logout();
              router.push("/login");
            }}
          >
            ログアウト
          </Button>
        </div>
      </div>
    </header>
  );
}
