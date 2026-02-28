"use client";

import { useState, useRef, useEffect } from "react";
import { useRouter } from "next/navigation";
import { useAuth } from "@/lib/auth";
import { toast } from "sonner";

export default function LoginPage() {
  const router = useRouter();
  const { login } = useAuth();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const [focusedField, setFocusedField] = useState<string | null>(null);
  const [showPassword, setShowPassword] = useState(false);
  const [mounted, setMounted] = useState(false);
  const emailRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    setMounted(true);
    // Auto-focus email field after mount animation
    const timer = setTimeout(() => emailRef.current?.focus(), 600);
    return () => clearTimeout(timer);
  }, []);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!email || !password) return;
    setIsLoading(true);
    try {
      await login(email, password);
      toast.success("ログインしました");
      router.push("/");
    } catch (err: any) {
      toast.error(err.message || "ログインに失敗しました");
    } finally {
      setIsLoading(false);
    }
  };

  const isFormValid = email.length > 0 && password.length > 0;

  return (
    <div className="login-page">
      {/* Ambient background */}
      <div className="login-bg" />

      {/* Main container */}
      <div className={`login-container ${mounted ? "login-visible" : ""}`}>
        {/* Logo & Branding */}
        <div className="login-brand">
          <div className="login-logo">
            <svg width="32" height="32" viewBox="0 0 32 32" fill="none">
              <path
                d="M16 3C9.373 3 4 8.373 4 15c0 4.55 2.533 8.512 6.267 10.542L9 28.5a.75.75 0 001.078.818L14.5 27h3l4.422 2.318A.75.75 0 0023 28.5l-1.267-2.958C25.467 23.512 28 19.55 28 15c0-6.627-5.373-12-12-12z"
                fill="url(#logo-gradient)"
              />
              <path
                d="M12 14.5c0-1.38.56-2.63 1.46-3.54A5 5 0 0121 14.5v1a1 1 0 01-1 1h-7a1 1 0 01-1-1v-.5z"
                fill="white"
                fillOpacity="0.9"
              />
              <circle cx="16" cy="19" r="1.5" fill="white" fillOpacity="0.9" />
              <defs>
                <linearGradient id="logo-gradient" x1="4" y1="3" x2="28" y2="28.5" gradientUnits="userSpaceOnUse">
                  <stop stopColor="#FF8C42" />
                  <stop offset="1" stopColor="#E85D26" />
                </linearGradient>
              </defs>
            </svg>
          </div>
          <h1 className="login-title">HotPep</h1>
          <p className="login-subtitle">席予約システム</p>
        </div>

        {/* Login Card */}
        <div className="login-card">
          <form onSubmit={handleSubmit} className="login-form" autoComplete="on">
            {/* Email Field */}
            <div className={`login-field ${focusedField === "email" ? "login-field-focused" : ""} ${email ? "login-field-filled" : ""}`}>
              <label htmlFor="email" className="login-label">
                <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
                  <rect x="2" y="4" width="20" height="16" rx="3" />
                  <path d="M22 7l-8.97 5.7a1.94 1.94 0 01-2.06 0L2 7" />
                </svg>
                <span>メールアドレス</span>
              </label>
              <input
                ref={emailRef}
                id="email"
                type="email"
                inputMode="email"
                autoComplete="email"
                autoCapitalize="none"
                enterKeyHint="next"
                placeholder="you@example.com"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                onFocus={() => setFocusedField("email")}
                onBlur={() => setFocusedField(null)}
                required
                className="login-input"
              />
            </div>

            {/* Password Field */}
            <div className={`login-field ${focusedField === "password" ? "login-field-focused" : ""} ${password ? "login-field-filled" : ""}`}>
              <label htmlFor="password" className="login-label">
                <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
                  <rect x="3" y="11" width="18" height="11" rx="3" />
                  <path d="M7 11V7a5 5 0 0110 0v4" />
                </svg>
                <span>パスワード</span>
              </label>
              <div className="login-password-wrap">
                <input
                  id="password"
                  type={showPassword ? "text" : "password"}
                  autoComplete="current-password"
                  enterKeyHint="go"
                  placeholder="パスワードを入力"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  onFocus={() => setFocusedField("password")}
                  onBlur={() => setFocusedField(null)}
                  required
                  className="login-input"
                />
                <button
                  type="button"
                  className="login-eye-btn"
                  onClick={() => setShowPassword(!showPassword)}
                  tabIndex={-1}
                  aria-label={showPassword ? "パスワードを隠す" : "パスワードを表示"}
                >
                  {showPassword ? (
                    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
                      <path d="M17.94 17.94A10.07 10.07 0 0112 20c-7 0-11-8-11-8a18.45 18.45 0 015.06-5.94" />
                      <path d="M9.9 4.24A9.12 9.12 0 0112 4c7 0 11 8 11 8a18.5 18.5 0 01-2.16 3.19" />
                      <line x1="1" y1="1" x2="23" y2="23" />
                      <path d="M14.12 14.12a3 3 0 11-4.24-4.24" />
                    </svg>
                  ) : (
                    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
                      <path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z" />
                      <circle cx="12" cy="12" r="3" />
                    </svg>
                  )}
                </button>
              </div>
            </div>

            {/* Submit Button */}
            <button
              type="submit"
              disabled={isLoading || !isFormValid}
              className={`login-submit ${isFormValid ? "login-submit-active" : ""}`}
            >
              {isLoading ? (
                <div className="login-spinner">
                  <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round">
                    <path d="M12 2v4M12 18v4M4.93 4.93l2.83 2.83M16.24 16.24l2.83 2.83M2 12h4M18 12h4M4.93 19.07l2.83-2.83M16.24 7.76l2.83-2.83" />
                  </svg>
                </div>
              ) : (
                <>
                  <span>ログイン</span>
                  <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                    <path d="M5 12h14M12 5l7 7-7 7" />
                  </svg>
                </>
              )}
            </button>
          </form>
        </div>

        {/* Demo Accounts */}
        <div className="login-demo">
          <div className="login-demo-header">
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <circle cx="12" cy="12" r="10" />
              <line x1="12" y1="16" x2="12" y2="12" />
              <line x1="12" y1="8" x2="12.01" y2="8" />
            </svg>
            <span>デモアカウント</span>
          </div>
          <div className="login-demo-accounts">
            <button
              type="button"
              className="login-demo-btn"
              onClick={() => { setEmail("admin@example.com"); setPassword("admin123"); }}
            >
              <div className="login-demo-avatar login-demo-avatar-admin">A</div>
              <div className="login-demo-info">
                <span className="login-demo-role">管理者</span>
                <span className="login-demo-email">admin@example.com</span>
              </div>
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="login-demo-arrow">
                <path d="M9 18l6-6-6-6" />
              </svg>
            </button>
            <button
              type="button"
              className="login-demo-btn"
              onClick={() => { setEmail("student1@example.com"); setPassword("student123"); }}
            >
              <div className="login-demo-avatar login-demo-avatar-student">S</div>
              <div className="login-demo-info">
                <span className="login-demo-role">生徒</span>
                <span className="login-demo-email">student1@example.com</span>
              </div>
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="login-demo-arrow">
                <path d="M9 18l6-6-6-6" />
              </svg>
            </button>
          </div>
        </div>

        {/* Footer */}
        <p className="login-footer">
          © {new Date().getFullYear()} HotPep
        </p>
      </div>
    </div>
  );
}
