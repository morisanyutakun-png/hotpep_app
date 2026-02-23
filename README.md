# HotPep - マルチテナント対応 席予約SaaS

「空席が見える。迷わず予約できる。」  
まずは個人塾の自習室向け。将来的にカフェ・コワーキングにも展開可能。

## アーキテクチャ

```
hotpep_app/
├── apps/
│   ├── web/          # Next.js (App Router) - Vercelデプロイ
│   └── api/          # FastAPI - Render/Railway等デプロイ
├── packages/
│   └── types/        # 共有型定義（将来OpenAPI生成）
├── docs/             # 設計メモ
└── README.md
```

### 技術スタック
- **Frontend**: Next.js 15 + TypeScript + Tailwind CSS + shadcn/ui + TanStack Query
- **Backend**: FastAPI + SQLAlchemy 2.x (async) + Pydantic v2
- **Database**: Neon (PostgreSQL)
- **認証**: JWT (python-jose + passlib/bcrypt)

## ローカル起動

### 前提条件
- Node.js 18+
- Python 3.11+
- Neon PostgreSQL インスタンス（または任意のPostgreSQL）

### 1. バックエンド（FastAPI）

```bash
cd apps/api

# Python仮想環境
python -m venv venv
source venv/bin/activate  # macOS/Linux

# 依存パッケージ
pip install -r requirements.txt

# 環境変数（.env を編集）
cp .env.example .env
# DATABASE_URL を Neon の接続文字列に変更
# JWT_SECRET_KEY を安全な値に変更

# DBマイグレーション（初回）
alembic upgrade head
# または seed.py でテーブル作成 + サンプルデータ投入
python seed.py

# 起動
uvicorn main:app --reload --port 8000
```

### 2. フロントエンド（Next.js）

```bash
cd apps/web

# 依存パッケージ
npm install

# 環境変数
# .env.local を確認（API URLとテナントID）

# 起動
npm run dev
```

### 3. アクセス
- フロントエンド: http://localhost:3000
- バックエンドAPI: http://localhost:8000
- API ドキュメント: http://localhost:8000/docs

### デモアカウント（seed.py 実行後）
| ロール | メール | パスワード |
|--------|--------|-----------|
| 管理者 | admin@example.com | admin123 |
| 生徒 | student1@example.com | student123 |
| 生徒 | student2@example.com | student123 |

## 環境変数

### Backend (.env)
| 変数 | 説明 | 例 |
|------|------|-----|
| DATABASE_URL | Neon接続文字列 (asyncpg) | postgresql+asyncpg://user:pass@host/db?sslmode=require |
| JWT_SECRET_KEY | JWT署名キー | ランダムな文字列 |
| JWT_ALGORITHM | JWTアルゴリズム | HS256 |
| ACCESS_TOKEN_EXPIRE_MINUTES | トークン有効期限(分) | 1440 |
| CORS_ORIGINS | 許可オリジン(カンマ区切り) | http://localhost:3000 |
| ENVIRONMENT | 環境名 | development / production |

### Frontend (.env.local)
| 変数 | 説明 | 例 |
|------|------|-----|
| NEXT_PUBLIC_API_URL | バックエンドAPI URL | http://localhost:8000 |
| NEXT_PUBLIC_DEFAULT_TENANT_ID | デフォルトテナントID | 00000000-... |

## API エンドポイント一覧

### Auth
- `POST /auth/login` - ログイン
- `GET /auth/me` - 現在のユーザー情報

### Spaces
- `GET /tenants/{tenant_id}/spaces` - スペース一覧
- `GET /spaces/{space_id}` - スペース詳細
- `POST /tenants/{tenant_id}/spaces` - スペース作成 (admin)

### Layout
- `GET /spaces/{space_id}/layout` - レイアウト取得
- `PUT /spaces/{space_id}/layout` - レイアウト保存 (admin)

### Time Slots
- `GET /spaces/{space_id}/time-slots` - 時間帯一覧
- `POST /spaces/{space_id}/time-slots` - 時間帯作成 (admin)

### Reservations
- `GET /spaces/{space_id}/availability?date=&time_slot_id=` - 空き状況
- `POST /reservations` - 予約作成
- `GET /my/reservations` - マイ予約
- `POST /reservations/{id}/cancel` - キャンセル

### Admin
- `GET /admin/dashboard` - ダッシュボード統計
- `GET /admin/reservations` - 予約管理
- `POST /admin/reservations/{id}/check-in` - チェックイン
- `POST /admin/reservations/{id}/mark-used` - 利用完了
- `POST /admin/reservations/{id}/mark-no-show` - 無断欠席
- `GET /admin/settings` - 設定取得
- `PUT /admin/settings` - 設定更新

## デプロイ

### Frontend → Vercel
1. GitHubリポジトリ連携
2. Root Directory: `apps/web`
3. 環境変数を設定
4. デプロイ

### Backend → Render / Railway / Fly.io
1. Root Directory: `apps/api`
2. Start command: `uvicorn main:app --host 0.0.0.0 --port $PORT`
3. 環境変数を設定（DATABASE_URL, JWT_SECRET_KEY等）
4. CORS_ORIGINSにVercelドメインを追加

### Database → Neon
1. Neonダッシュボードでプロジェクト作成
2. 接続文字列をコピー（asyncpg形式に変換）
3. `alembic upgrade head` でマイグレーション実行

## ドメインルール
1. 同一ユーザーは同一時間帯に複数予約不可
2. 同じ席・同じ時間帯の重複予約不可（DB制約 + API判定）
3. ペナルティ中ユーザーは予約不可
4. 予約締切（開始N分前）を超えたら予約不可
5. no_show → 自動ペナルティ付与（N日間予約停止）
6. 管理者・利用者の権限分離
7. テナント間データ参照禁止
