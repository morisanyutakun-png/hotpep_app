# HotPep デプロイガイド

Neon (DB) + Koyeb (API) + Vercel (Frontend) の構成

---

## 1. Neon (PostgreSQL)

1. [Neon Console](https://console.neon.tech/) でプロジェクトを作成
2. 接続文字列をコピー (例: `postgresql://user:pass@ep-xxxx.us-east-2.aws.neon.tech/neondb?sslmode=require`)
3. SQLAlchemy用に `postgresql+asyncpg://` プレフィックスに置き換える

```
postgresql+asyncpg://user:pass@ep-xxxx.us-east-2.aws.neon.tech/neondb?sslmode=require
```

### 初回のマイグレーション & シード

ローカルから実行:

```bash
cd apps/api
export DATABASE_URL="postgresql+asyncpg://user:pass@ep-xxxx.us-east-2.aws.neon.tech/neondb?sslmode=require"
python -m alembic upgrade head
python seed.py
```

---

## 2. Koyeb (API Backend)

### GitHub連携でデプロイ (推奨)

1. [Koyeb Console](https://app.koyeb.com/) でアカウント作成
2. **Create Service** → **GitHub** を選択
3. リポジトリを選択し、以下を設定:

| 設定 | 値 |
|------|-----|
| Builder | Dockerfile |
| Dockerfile path | `apps/api/Dockerfile` |
| Work directory | `apps/api` |
| Port | `8000` |

4. **環境変数** を設定:

| 変数名 | 値 |
|--------|-----|
| `DATABASE_URL` | Neonの接続文字列 (`postgresql+asyncpg://...`) |
| `JWT_SECRET_KEY` | 安全なランダム文字列 (`openssl rand -hex 32` で生成) |
| `JWT_ALGORITHM` | `HS256` |
| `ACCESS_TOKEN_EXPIRE_MINUTES` | `1440` |
| `CORS_ORIGINS` | Vercelのデプロイ後のURL (例: `https://hotpep.vercel.app`) |
| `ENVIRONMENT` | `production` |

5. **Deploy** をクリック

### デプロイ後の確認

```bash
curl https://your-app.koyeb.app/health
# → {"status":"ok"}
```

---

## 3. Vercel (Frontend)

1. [Vercel Dashboard](https://vercel.com/dashboard) でプロジェクトをインポート
2. **Import Git Repository** でリポジトリを選択
3. 以下を設定:

| 設定 | 値 |
|------|-----|
| Root Directory | `apps/web` |
| Framework Preset | Next.js (自動検知) |
| Build Command | `npm run build` |
| Output Directory | `.next` |

4. **Environment Variables** を設定:

| 変数名 | 値 |
|--------|-----|
| `NEXT_PUBLIC_API_URL` | KoyebのURL (例: `https://your-app.koyeb.app`) |
| `NEXT_PUBLIC_DEFAULT_TENANT_ID` | `00000000-0000-0000-0000-000000000001` |

5. **Deploy** をクリック

---

## 4. デプロイ後の設定

### CORS設定の更新

Vercelのデプロイ完了後、KoyebのCORS_ORIGINS環境変数にVercelのURLを設定:

```
CORS_ORIGINS=https://hotpep.vercel.app
```

複数のオリジンが必要な場合 (カスタムドメインなど):

```
CORS_ORIGINS=https://hotpep.vercel.app,https://custom-domain.com
```

### カスタムドメイン (任意)

- **Vercel**: Settings → Domains でカスタムドメインを追加
- **Koyeb**: Settings → Custom Domains でAPIドメインを追加

---

## トラブルシューティング

### DBに接続できない
- Neonの接続文字列に `?sslmode=require` が含まれているか確認
- プレフィックスが `postgresql+asyncpg://` であることを確認

### CORSエラー
- Koyebの `CORS_ORIGINS` にVercelのURLが正確に設定されているか確認 (末尾スラッシュなし)

### APIにアクセスできない
- Koyebのヘルスチェックが通っているか確認: `GET /health`
- フロントエンドの `NEXT_PUBLIC_API_URL` がKoyebのURLと一致しているか確認
