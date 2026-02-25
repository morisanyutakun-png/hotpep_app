"use client";

import { useState, useEffect } from "react";
import Link from "next/link";
import { apiFetch } from "@/lib/api";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { toast } from "sonner";
import { Check } from "lucide-react";

interface Tenant {
  id: string;
  name: string;
  slug: string;
}

type Step = "auth" | "tenant" | "account";

export default function RegisterPage() {
  // Step management
  const [step, setStep] = useState<Step>("auth");
  const [setupPassword, setSetupPassword] = useState("");
  const [isVerified, setIsVerified] = useState(false);

  // Tenant step
  const [tenantMode, setTenantMode] = useState<"new" | "existing">("new");
  const [tenantName, setTenantName] = useState("");
  const [tenantSlug, setTenantSlug] = useState("");
  const [tenantDescription, setTenantDescription] = useState("");
  const [tenants, setTenants] = useState<Tenant[]>([]);
  const [selectedTenantId, setSelectedTenantId] = useState("");

  // Account step
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [displayName, setDisplayName] = useState("");
  const [role, setRole] = useState("student");

  const [isLoading, setIsLoading] = useState(false);

  // テナント名からslugを自動生成
  useEffect(() => {
    if (tenantName) {
      const slug = tenantName
        .toLowerCase()
        .replace(/[^\w\s\u3040-\u309f\u30a0-\u30ff\u4e00-\u9faf-]/g, "")
        .replace(/[\s\u3040-\u309f\u30a0-\u30ff\u4e00-\u9faf]+/g, "-")
        .replace(/^-+|-+$/g, "");
      setTenantSlug(slug || `tenant-${Date.now()}`);
    }
  }, [tenantName]);

  // Step 1: セットアップパスワード認証
  const handleVerifyPassword = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsLoading(true);
    try {
      await apiFetch<{ verified: boolean }>("/auth/verify-setup-password", {
        method: "POST",
        body: JSON.stringify({ password: setupPassword }),
      });
      setIsVerified(true);
      toast.success("認証に成功しました");

      // テナント一覧を取得
      const tenantData = await apiFetch<Tenant[]>("/auth/tenants");
      setTenants(tenantData);
      if (tenantData.length > 0) {
        setTenantMode("existing");
        setSelectedTenantId(tenantData[0].id);
      }

      setStep("tenant");
    } catch (err: any) {
      toast.error(err.message || "パスワードが正しくありません");
    } finally {
      setIsLoading(false);
    }
  };

  // Step 2: テナント登録/選択
  const handleTenantStep = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsLoading(true);
    try {
      if (tenantMode === "new") {
        const data = await apiFetch<Tenant>("/auth/tenants/create", {
          method: "POST",
          body: JSON.stringify({
            setup_password: setupPassword,
            name: tenantName,
            slug: tenantSlug,
            description: tenantDescription || null,
          }),
        });
        setSelectedTenantId(data.id);
        setTenants((prev) => [...prev, data]);
        toast.success(`テナント「${data.name}」を作成しました`);
      }
      setStep("account");
    } catch (err: any) {
      toast.error(err.message || "テナント作成に失敗しました");
    } finally {
      setIsLoading(false);
    }
  };

  // Step 3: アカウント作成
  const handleCreateAccount = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsLoading(true);
    try {
      const data = await apiFetch<{ access_token: string; tenant_id: string | null }>("/auth/register", {
        method: "POST",
        body: JSON.stringify({
          email,
          password,
          display_name: displayName,
          tenant_id: selectedTenantId || null,
          role,
        }),
      });
      localStorage.setItem("token", data.access_token);
      if (data.tenant_id) {
        localStorage.setItem("tenantId", data.tenant_id);
      }
      toast.success("アカウントを作成しました");
      window.location.href = "/";
    } catch (err: any) {
      toast.error(err.message || "アカウント作成に失敗しました");
    } finally {
      setIsLoading(false);
    }
  };

  const stepLabels = [
    { key: "auth", label: "認証", num: 1 },
    { key: "tenant", label: "テナント", num: 2 },
    { key: "account", label: "アカウント", num: 3 },
  ];

  const currentStepIndex = stepLabels.findIndex((s) => s.key === step);

  return (
    <div className="min-h-screen flex items-center justify-center bg-warm-gradient p-4">
      <div className="w-full max-w-md animate-fade-in-up">
      <Card className="shadow-premium-lg border-border/40">
        <CardHeader className="space-y-1 text-center pb-2">
          <div className="flex justify-center mb-4">
            <div className="w-14 h-14 bg-gradient-to-br from-primary to-primary/80 rounded-2xl flex items-center justify-center shadow-lg shadow-primary/20">
              <span className="text-white text-2xl font-bold tracking-tight">H</span>
            </div>
          </div>
          <CardTitle className="text-2xl font-bold tracking-tight">HotPep セットアップ</CardTitle>
          <CardDescription className="text-muted-foreground/80">
            テナント登録とアカウント作成
          </CardDescription>

          {/* ステップインジケーター */}
          <div className="flex items-center justify-center gap-2 pt-4">
            {stepLabels.map((s, i) => (
              <div key={s.key} className="flex items-center gap-2">
                <div className="flex flex-col items-center">
                  <div
                    className={`w-8 h-8 rounded-full flex items-center justify-center text-sm font-bold transition-all duration-300 ${
                      i < currentStepIndex
                        ? "bg-emerald-500 text-white shadow-sm shadow-emerald-200"
                        : i === currentStepIndex
                        ? "bg-primary text-white shadow-sm shadow-primary/25"
                        : "bg-muted text-muted-foreground"
                    }`}
                  >
                    {i < currentStepIndex ? <Check className="w-3.5 h-3.5" /> : s.num}
                  </div>
                  <span className={`text-xs mt-1.5 font-medium ${i === currentStepIndex ? "text-primary" : "text-muted-foreground/60"}`}>
                    {s.label}
                  </span>
                </div>
                {i < stepLabels.length - 1 && (
                  <div className={`w-8 h-0.5 mb-5 rounded-full transition-colors duration-300 ${i < currentStepIndex ? "bg-emerald-500" : "bg-muted"}`} />
                )}
              </div>
            ))}
          </div>
        </CardHeader>

        <CardContent>
          {/* Step 1: 認証 */}
          {step === "auth" && (
            <form onSubmit={handleVerifyPassword} className="space-y-5">
              <div className="p-4 bg-accent/60 border border-border/40 rounded-xl text-sm text-foreground/70">
                セットアップを開始するには、認証パスワードを入力してください。
              </div>
              <div className="space-y-2">
                <Label htmlFor="setupPassword" className="text-sm font-medium text-foreground/80">認証パスワード</Label>
                <Input
                  id="setupPassword"
                  type="password"
                  placeholder="認証パスワードを入力"
                  value={setupPassword}
                  onChange={(e) => setSetupPassword(e.target.value)}
                  required
                  autoFocus
                />
              </div>
              <Button
                type="submit"
                className="w-full btn-glow"
                disabled={isLoading || !setupPassword}
              >
                {isLoading ? "認証中..." : "認証する"}
              </Button>
            </form>
          )}

          {/* Step 2: テナント登録/選択 */}
          {step === "tenant" && (
            <form onSubmit={handleTenantStep} className="space-y-5">
              {tenants.length > 0 && (
                <div className="flex gap-2">
                  <Button
                    type="button"
                    variant={tenantMode === "existing" ? "default" : "outline"}
                    className={`flex-1 text-sm ${tenantMode === "existing" ? "" : ""}`}
                    onClick={() => setTenantMode("existing")}
                  >
                    既存テナントを選択
                  </Button>
                  <Button
                    type="button"
                    variant={tenantMode === "new" ? "default" : "outline"}
                    className={`flex-1 text-sm ${tenantMode === "new" ? "" : ""}`}
                    onClick={() => setTenantMode("new")}
                  >
                    新規テナント作成
                  </Button>
                </div>
              )}

              {tenantMode === "existing" && tenants.length > 0 ? (
                <div className="space-y-2">
                  <Label>所属テナント</Label>
                  <Select value={selectedTenantId} onValueChange={setSelectedTenantId}>
                    <SelectTrigger>
                      <SelectValue placeholder="テナントを選択" />
                    </SelectTrigger>
                    <SelectContent>
                      {tenants.map((t) => (
                        <SelectItem key={t.id} value={t.id}>
                          {t.name}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              ) : (
                <>
                  <div className="space-y-2">
                    <Label htmlFor="tenantName">テナント名 *</Label>
                    <Input
                      id="tenantName"
                      type="text"
                      placeholder="例: ○○学習塾"
                      value={tenantName}
                      onChange={(e) => setTenantName(e.target.value)}
                      required
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="tenantSlug">スラッグ (URL用ID) *</Label>
                    <Input
                      id="tenantSlug"
                      type="text"
                      placeholder="例: my-juku"
                      value={tenantSlug}
                      onChange={(e) => setTenantSlug(e.target.value)}
                      required
                    />
                    <p className="text-xs text-muted-foreground">英数字・ハイフンのみ。テナント名から自動生成されます。</p>
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="tenantDescription">説明（任意）</Label>
                    <Input
                      id="tenantDescription"
                      type="text"
                      placeholder="例: 個人塾の自習室予約"
                      value={tenantDescription}
                      onChange={(e) => setTenantDescription(e.target.value)}
                    />
                  </div>
                </>
              )}

              <div className="flex gap-2">
                <Button
                  type="button"
                  variant="outline"
                  className="flex-1"
                  onClick={() => setStep("auth")}
                >
                  戻る
                </Button>
                <Button
                  type="submit"
                  className="flex-1 btn-glow"
                  disabled={isLoading || (tenantMode === "new" && (!tenantName || !tenantSlug))}
                >
                  {isLoading ? "処理中..." : "次へ"}
                </Button>
              </div>
            </form>
          )}

          {/* Step 3: アカウント作成 */}
          {step === "account" && (
            <form onSubmit={handleCreateAccount} className="space-y-5">
              <div className="p-4 bg-emerald-50/60 border border-emerald-200/40 rounded-xl text-sm text-emerald-700">
                テナント: {tenants.find((t) => t.id === selectedTenantId)?.name || "新規作成済み"}
              </div>
              <div className="space-y-2">
                <Label htmlFor="displayName">表示名</Label>
                <Input
                  id="displayName"
                  type="text"
                  placeholder="山田太郎"
                  value={displayName}
                  onChange={(e) => setDisplayName(e.target.value)}
                  required
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="email">メールアドレス</Label>
                <Input
                  id="email"
                  type="email"
                  placeholder="example@mail.com"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  required
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="password">パスワード</Label>
                <Input
                  id="password"
                  type="password"
                  placeholder="パスワードを入力"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  required
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="role">ロール</Label>
                <Select value={role} onValueChange={setRole}>
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="admin">管理者 (admin)</SelectItem>
                    <SelectItem value="student">生徒 (student)</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div className="flex gap-2">
                <Button
                  type="button"
                  variant="outline"
                  className="flex-1"
                  onClick={() => setStep("tenant")}
                >
                  戻る
                </Button>
                <Button
                  type="submit"
                  className="flex-1 btn-glow"
                  disabled={isLoading}
                >
                  {isLoading ? "作成中..." : "アカウント作成"}
                </Button>
              </div>
            </form>
          )}

          <div className="mt-5 text-center text-sm text-muted-foreground">
            既にアカウントをお持ちですか？{" "}
            <Link
              href="/login"
              className="text-primary hover:text-primary/80 font-semibold transition-colors"
            >
              ログイン
            </Link>
          </div>
        </CardContent>
      </Card>
      </div>
    </div>
  );
}
