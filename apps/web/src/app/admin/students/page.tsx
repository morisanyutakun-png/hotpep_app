"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useAuth } from "@/lib/auth";
import { useApiFetch } from "@/hooks/use-api";
import { Header } from "@/components/header";
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
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { Badge } from "@/components/ui/badge";
import { toast } from "sonner";

interface Student {
  id: string;
  email: string;
  display_name: string;
  is_active: boolean;
  role: string;
}

interface StudentLoginResponse {
  access_token: string;
  token_type: string;
  student: Student;
}

export default function AdminStudentsPage() {
  const router = useRouter();
  const { user, role, isLoading: authLoading } = useAuth();
  const apiFetch = useApiFetch();
  const queryClient = useQueryClient();

  // 新規登録フォーム
  const [showCreateDialog, setShowCreateDialog] = useState(false);
  const [newEmail, setNewEmail] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [newDisplayName, setNewDisplayName] = useState("");

  // ログインフォーム
  const [showLoginDialog, setShowLoginDialog] = useState(false);
  const [loginEmail, setLoginEmail] = useState("");
  const [loginPassword, setLoginPassword] = useState("");

  // 編集
  const [editingStudent, setEditingStudent] = useState<Student | null>(null);
  const [editDisplayName, setEditDisplayName] = useState("");
  const [editPassword, setEditPassword] = useState("");

  useEffect(() => {
    if (!authLoading) {
      if (!user) router.push("/login");
      else if (role !== "admin") router.push("/");
    }
  }, [authLoading, user, role, router]);

  // 生徒一覧取得
  const {
    data: students,
    isLoading,
  } = useQuery({
    queryKey: ["adminStudents"],
    queryFn: () => apiFetch<Student[]>("/admin/students"),
    enabled: !!user && role === "admin",
  });

  // 生徒作成
  const createMutation = useMutation({
    mutationFn: (data: { email: string; password: string; display_name: string }) =>
      apiFetch<Student>("/admin/students", {
        method: "POST",
        body: JSON.stringify(data),
      }),
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: ["adminStudents"] });
      toast.success(`生徒「${data.display_name}」を登録しました`);
      setShowCreateDialog(false);
      setNewEmail("");
      setNewPassword("");
      setNewDisplayName("");
    },
    onError: (err: Error) => {
      toast.error(err.message || "生徒登録に失敗しました");
    },
  });

  // 生徒ログイン（代理）
  const loginMutation = useMutation({
    mutationFn: (data: { email: string; password: string }) =>
      apiFetch<StudentLoginResponse>("/admin/students/login", {
        method: "POST",
        body: JSON.stringify(data),
      }),
    onSuccess: (data) => {
      // 代理ログイン: トークンを置き換えてリダイレクト
      localStorage.setItem("token", data.access_token);
      toast.success(`${data.student.display_name} としてログインしました`);
      window.location.href = "/";
    },
    onError: (err: Error) => {
      toast.error(err.message || "ログインに失敗しました");
    },
  });

  // 生徒更新
  const updateMutation = useMutation({
    mutationFn: (data: { id: string; display_name?: string; password?: string; is_active?: boolean }) => {
      const { id, ...body } = data;
      // 空文字列のフィールドは送らない
      const payload: Record<string, unknown> = {};
      if (body.display_name) payload.display_name = body.display_name;
      if (body.password) payload.password = body.password;
      if (body.is_active !== undefined) payload.is_active = body.is_active;
      return apiFetch<Student>(`/admin/students/${id}`, {
        method: "PUT",
        body: JSON.stringify(payload),
      });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["adminStudents"] });
      toast.success("生徒情報を更新しました");
      setEditingStudent(null);
    },
    onError: (err: Error) => {
      toast.error(err.message || "更新に失敗しました");
    },
  });

  // 生徒削除（テナントから除外）
  const deleteMutation = useMutation({
    mutationFn: (id: string) =>
      apiFetch<{ deleted: boolean }>(`/admin/students/${id}`, {
        method: "DELETE",
      }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["adminStudents"] });
      toast.success("生徒をテナントから除外しました");
    },
    onError: (err: Error) => {
      toast.error(err.message || "削除に失敗しました");
    },
  });

  // 有効/無効トグル
  const toggleActive = (student: Student) => {
    updateMutation.mutate({
      id: student.id,
      is_active: !student.is_active,
    });
  };

  if (authLoading || !user || role !== "admin") {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="animate-pulse text-muted-foreground">読み込み中...</div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50">
      <Header />
      <main className="max-w-4xl mx-auto px-4 py-8">
        <div className="flex items-center justify-between mb-6">
          <div>
            <h1 className="text-2xl font-bold text-gray-900">生徒管理</h1>
            <p className="text-muted-foreground mt-1">
              生徒アカウントの登録・管理・ログイン
            </p>
          </div>
          <div className="flex gap-2">
            {/* 生徒ログインダイアログ */}
            <Dialog open={showLoginDialog} onOpenChange={setShowLoginDialog}>
              <DialogTrigger asChild>
                <Button variant="outline">
                  生徒としてログイン
                </Button>
              </DialogTrigger>
              <DialogContent>
                <DialogHeader>
                  <DialogTitle>生徒ログイン（代理）</DialogTitle>
                  <DialogDescription>
                    生徒のメールアドレスとパスワードでログインします。管理者セッションは終了します。
                  </DialogDescription>
                </DialogHeader>
                <form
                  onSubmit={(e) => {
                    e.preventDefault();
                    loginMutation.mutate({ email: loginEmail, password: loginPassword });
                  }}
                  className="space-y-4"
                >
                  <div className="space-y-2">
                    <Label htmlFor="loginEmail">メールアドレス</Label>
                    <Input
                      id="loginEmail"
                      type="email"
                      placeholder="student@example.com"
                      value={loginEmail}
                      onChange={(e) => setLoginEmail(e.target.value)}
                      required
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="loginPassword">パスワード</Label>
                    <Input
                      id="loginPassword"
                      type="password"
                      placeholder="パスワード"
                      value={loginPassword}
                      onChange={(e) => setLoginPassword(e.target.value)}
                      required
                    />
                  </div>
                  <Button
                    type="submit"
                    className="w-full bg-blue-600 hover:bg-blue-700"
                    disabled={loginMutation.isPending}
                  >
                    {loginMutation.isPending ? "ログイン中..." : "この生徒としてログイン"}
                  </Button>
                </form>
              </DialogContent>
            </Dialog>

            {/* 新規生徒登録ダイアログ */}
            <Dialog open={showCreateDialog} onOpenChange={setShowCreateDialog}>
              <DialogTrigger asChild>
                <Button className="bg-orange-500 hover:bg-orange-600">
                  + 生徒を登録
                </Button>
              </DialogTrigger>
              <DialogContent>
                <DialogHeader>
                  <DialogTitle>新規生徒登録</DialogTitle>
                  <DialogDescription>
                    生徒のアカウントを作成します。作成後、生徒はこのメールアドレスとパスワードでログインできます。
                  </DialogDescription>
                </DialogHeader>
                <form
                  onSubmit={(e) => {
                    e.preventDefault();
                    createMutation.mutate({
                      email: newEmail,
                      password: newPassword,
                      display_name: newDisplayName,
                    });
                  }}
                  className="space-y-4"
                >
                  <div className="space-y-2">
                    <Label htmlFor="newDisplayName">表示名</Label>
                    <Input
                      id="newDisplayName"
                      type="text"
                      placeholder="山田太郎"
                      value={newDisplayName}
                      onChange={(e) => setNewDisplayName(e.target.value)}
                      required
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="newEmail">メールアドレス</Label>
                    <Input
                      id="newEmail"
                      type="email"
                      placeholder="student@example.com"
                      value={newEmail}
                      onChange={(e) => setNewEmail(e.target.value)}
                      required
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="newPassword">パスワード</Label>
                    <Input
                      id="newPassword"
                      type="password"
                      placeholder="初期パスワード"
                      value={newPassword}
                      onChange={(e) => setNewPassword(e.target.value)}
                      required
                      minLength={4}
                    />
                  </div>
                  <Button
                    type="submit"
                    className="w-full bg-orange-500 hover:bg-orange-600"
                    disabled={createMutation.isPending}
                  >
                    {createMutation.isPending ? "登録中..." : "生徒を登録"}
                  </Button>
                </form>
              </DialogContent>
            </Dialog>
          </div>
        </div>

        {/* 生徒一覧 */}
        {isLoading ? (
          <div className="text-center py-12 text-muted-foreground">読み込み中...</div>
        ) : !students || students.length === 0 ? (
          <Card>
            <CardContent className="py-12 text-center">
              <p className="text-muted-foreground mb-4">まだ生徒が登録されていません</p>
              <Button
                className="bg-orange-500 hover:bg-orange-600"
                onClick={() => setShowCreateDialog(true)}
              >
                最初の生徒を登録する
              </Button>
            </CardContent>
          </Card>
        ) : (
          <div className="space-y-3">
            <p className="text-sm text-muted-foreground">{students.length} 名の生徒</p>
            {students.map((student) => (
              <Card key={student.id} className="hover:shadow-sm transition-shadow">
                <CardContent className="py-4 px-5">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-3">
                      <div className="w-10 h-10 rounded-full bg-orange-100 flex items-center justify-center">
                        <span className="text-orange-600 font-bold text-sm">
                          {student.display_name.charAt(0)}
                        </span>
                      </div>
                      <div>
                        <div className="flex items-center gap-2">
                          <span className="font-medium text-gray-900">{student.display_name}</span>
                          {student.is_active ? (
                            <Badge variant="outline" className="text-green-600 border-green-200 bg-green-50 text-xs">
                              有効
                            </Badge>
                          ) : (
                            <Badge variant="outline" className="text-red-600 border-red-200 bg-red-50 text-xs">
                              無効
                            </Badge>
                          )}
                        </div>
                        <p className="text-sm text-muted-foreground">{student.email}</p>
                      </div>
                    </div>
                    <div className="flex items-center gap-2">
                      <Button
                        variant="ghost"
                        size="sm"
                        className="text-blue-600 hover:text-blue-700 hover:bg-blue-50"
                        onClick={() => {
                          setLoginEmail(student.email);
                          setLoginPassword("");
                          setShowLoginDialog(true);
                        }}
                      >
                        ログイン
                      </Button>
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => {
                          setEditingStudent(student);
                          setEditDisplayName(student.display_name);
                          setEditPassword("");
                        }}
                      >
                        編集
                      </Button>
                      <Button
                        variant="ghost"
                        size="sm"
                        className={student.is_active ? "text-amber-600 hover:text-amber-700" : "text-green-600 hover:text-green-700"}
                        onClick={() => toggleActive(student)}
                      >
                        {student.is_active ? "無効化" : "有効化"}
                      </Button>
                      <Button
                        variant="ghost"
                        size="sm"
                        className="text-red-600 hover:text-red-700 hover:bg-red-50"
                        onClick={() => {
                          if (confirm(`${student.display_name} をテナントから除外しますか？`)) {
                            deleteMutation.mutate(student.id);
                          }
                        }}
                      >
                        除外
                      </Button>
                    </div>
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>
        )}

        {/* 編集ダイアログ */}
        <Dialog open={!!editingStudent} onOpenChange={(open) => !open && setEditingStudent(null)}>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>生徒情報の編集</DialogTitle>
              <DialogDescription>
                {editingStudent?.email} の情報を変更します
              </DialogDescription>
            </DialogHeader>
            <form
              onSubmit={(e) => {
                e.preventDefault();
                if (editingStudent) {
                  updateMutation.mutate({
                    id: editingStudent.id,
                    display_name: editDisplayName || undefined,
                    password: editPassword || undefined,
                  });
                }
              }}
              className="space-y-4"
            >
              <div className="space-y-2">
                <Label htmlFor="editDisplayName">表示名</Label>
                <Input
                  id="editDisplayName"
                  type="text"
                  value={editDisplayName}
                  onChange={(e) => setEditDisplayName(e.target.value)}
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="editPassword">新しいパスワード（変更する場合のみ）</Label>
                <Input
                  id="editPassword"
                  type="password"
                  placeholder="変更しない場合は空欄"
                  value={editPassword}
                  onChange={(e) => setEditPassword(e.target.value)}
                />
              </div>
              <div className="flex gap-2">
                <Button
                  type="button"
                  variant="outline"
                  className="flex-1"
                  onClick={() => setEditingStudent(null)}
                >
                  キャンセル
                </Button>
                <Button
                  type="submit"
                  className="flex-1 bg-orange-500 hover:bg-orange-600"
                  disabled={updateMutation.isPending}
                >
                  {updateMutation.isPending ? "保存中..." : "保存"}
                </Button>
              </div>
            </form>
          </DialogContent>
        </Dialog>
      </main>
    </div>
  );
}
