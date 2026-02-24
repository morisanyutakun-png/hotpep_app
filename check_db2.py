import asyncio
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
    
    # Check tenants
    tenants = await conn.fetch("SELECT id, name, slug, is_active FROM tenants")
    print(f"Tenants ({len(tenants)}):")
    for t in tenants:
        print(f"  - {t['id']} | {t['name']} | {t['slug']} | active={t['is_active']}")
    
    # Check users
    users = await conn.fetch("SELECT id, email, display_name, is_active FROM users")
    print(f"\nUsers ({len(users)}):")
    for u in users:
        print(f"  - {u['id']} | {u['email']} | {u['display_name']} | active={u['is_active']}")

    # Check memberships
    memberships = await conn.fetch("SELECT id, tenant_id, user_id, role FROM memberships")
    print(f"\nMemberships ({len(memberships)}):")
    for m in memberships:
        print(f"  - {m['id']} | tenant={m['tenant_id']} | user={m['user_id']} | role={m['role']}")

    # Check tenant_settings
    settings = await conn.fetch("SELECT tenant_id FROM tenant_settings")
    print(f"\nTenantSettings ({len(settings)}):")
    for s in settings:
        print(f"  - tenant_id={s['tenant_id']}")

    await conn.close()

asyncio.run(check())
