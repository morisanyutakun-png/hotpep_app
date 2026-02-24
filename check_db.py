import asyncio
import ssl
import sys

sys.path.insert(0, "/Users/moriyuuta/hotpep_app/apps/api")

async def check():
    import asyncpg
    conn = await asyncpg.connect(
        host="ep-restless-hat-aitwp9df-pooler.c-4.us-east-1.aws.neon.tech",
        database="neondb",
        user="neondb_owner",
        password="npg_J10PhzUljOZM",
        ssl="require",
    )
    rows = await conn.fetch(
        "SELECT table_name FROM information_schema.tables WHERE table_schema = 'public' ORDER BY table_name"
    )
    print("Tables in DB:")
    for r in rows:
        print(f"  - {r['table_name']}")
    if not rows:
        print("  (NONE - no tables exist!)")
    await conn.close()

asyncio.run(check())
