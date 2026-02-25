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
    <header className="sticky top-0 z-50 glass border-b border-border/40">
      <div className="max-w-7xl mx-auto px-6 h-16 flex items-center justify-between">
        <div className="flex items-center gap-8">
          <Link href="/" className="flex items-center gap-2.5 group">
            <div className="w-9 h-9 bg-gradient-to-br from-primary to-primary/80 rounded-xl flex items-center justify-center shadow-sm group-hover:shadow-md transition-all duration-300 group-hover:scale-105">
              <span className="text-white text-sm font-bold tracking-tight">H</span>
            </div>
            <span className="font-semibold text-lg tracking-tight text-foreground/90 hidden sm:inline">HotPep</span>
          </Link>

          <nav className="flex items-center gap-0.5 text-sm">
            <Link
              href="/"
              className="px-3.5 py-2 rounded-xl font-medium text-foreground/65 hover:text-foreground hover:bg-accent/60 transition-all duration-200"
            >
              スペース一覧
            </Link>
            <Link
              href="/my-reservations"
              className="px-3.5 py-2 rounded-xl font-medium text-foreground/65 hover:text-foreground hover:bg-accent/60 transition-all duration-200"
            >
              マイ予約
            </Link>
            {role === "admin" && (
              <Link
                href="/admin"
                className="px-3.5 py-2 rounded-xl font-medium text-foreground/65 hover:text-foreground hover:bg-accent/60 transition-all duration-200"
              >
                管理画面
              </Link>
            )}
          </nav>
        </div>

        <div className="flex items-center gap-4">
          <span className="text-sm text-muted-foreground hidden sm:inline font-medium">
            {user.display_name}
          </span>
          {role === "admin" && (
            <span className="text-[11px] bg-primary/10 text-primary px-2.5 py-1 rounded-full font-semibold tracking-tight">
              管理者
            </span>
          )}
          <Button
            variant="ghost"
            size="sm"
            className="text-muted-foreground hover:text-foreground"
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
