from sqlalchemy.ext.asyncio import create_async_engine, AsyncSession, async_sessionmaker
from sqlalchemy import inspect, text
from models.database import Base
from core.config import (
    DATABASE_URL,
    FREE_MONTHLY_QUOTA,
    PROMO_VIP2_BONUS_QUOTA,
    PRO_MONTHLY_QUOTA,
    VIP1_IMAGE_QUOTA,
    VIP2_IMAGE_QUOTA,
    VIP3_IMAGE_QUOTA,
)

engine = create_async_engine(DATABASE_URL, echo=False)
async_session = async_sessionmaker(engine, class_=AsyncSession, expire_on_commit=False)


async def get_db():
    async with async_session() as session:
        yield session


async def init_db():
    async with engine.begin() as conn:
        await conn.run_sync(Base.metadata.create_all)
        await ensure_user_admin_columns(conn)
        await ensure_generation_log_columns(conn)
    await sync_plan_quotas()


async def ensure_user_admin_columns(conn):
    def existing_columns(sync_conn):
        return {column["name"] for column in inspect(sync_conn).get_columns("users")}

    columns = await conn.run_sync(existing_columns)
    datetime_type = "DATETIME" if conn.dialect.name == "sqlite" else "TIMESTAMP"
    bool_false = "0" if conn.dialect.name == "sqlite" else "FALSE"
    additions = {
        "phone": "VARCHAR(50)",
        "role": "VARCHAR(20) DEFAULT 'user' NOT NULL",
        "vip_level": "VARCHAR(20) DEFAULT 'normal' NOT NULL",
        "image_quota_total": f"INTEGER DEFAULT {FREE_MONTHLY_QUOTA} NOT NULL",
        "image_quota_used": "INTEGER DEFAULT 0 NOT NULL",
        "image_quota_remaining": f"INTEGER DEFAULT {FREE_MONTHLY_QUOTA} NOT NULL",
        "free_generation_count": "INTEGER DEFAULT 0 NOT NULL",
        "promo_popup_shown": f"BOOLEAN DEFAULT {bool_false} NOT NULL",
        "promo_vip2_used": f"BOOLEAN DEFAULT {bool_false} NOT NULL",
        "status": "VARCHAR(20) DEFAULT 'active' NOT NULL",
        "last_login_at": datetime_type,
    }

    for column_name, column_sql in additions.items():
        if column_name not in columns:
            await conn.execute(text(f"ALTER TABLE users ADD COLUMN {column_name} {column_sql}"))

    await conn.execute(
        text(
            """
            UPDATE users
            SET
                role = COALESCE(role, 'user'),
                vip_level = COALESCE(vip_level, 'normal'),
                image_quota_total = COALESCE(image_quota_total, :free_quota),
                image_quota_used = COALESCE(image_quota_used, 0),
                image_quota_remaining = COALESCE(image_quota_remaining, image_quota_total - image_quota_used, :free_quota),
                free_generation_count = COALESCE(free_generation_count, 0),
                promo_popup_shown = COALESCE(promo_popup_shown, :false_value),
                promo_vip2_used = COALESCE(promo_vip2_used, :false_value),
                status = COALESCE(status, 'active')
            """
        ),
        {"free_quota": FREE_MONTHLY_QUOTA, "false_value": False},
    )


async def ensure_generation_log_columns(conn):
    def existing_columns(sync_conn):
        return {column["name"] for column in inspect(sync_conn).get_columns("image_generation_logs")}

    columns = await conn.run_sync(existing_columns)
    additions = {
        "success_count": "INTEGER DEFAULT 0 NOT NULL",
        "failed_count": "INTEGER DEFAULT 0 NOT NULL",
    }

    for column_name, column_sql in additions.items():
        if column_name not in columns:
            await conn.execute(text(f"ALTER TABLE image_generation_logs ADD COLUMN {column_name} {column_sql}"))

    await conn.execute(
        text(
            """
            UPDATE image_generation_logs
            SET
                success_count = CASE
                    WHEN status IN ('success', 'partial_success') THEN COALESCE(quota_used, image_count, 0)
                    ELSE COALESCE(success_count, 0)
                END,
                failed_count = CASE
                    WHEN status = 'failed' THEN COALESCE(image_count, 1)
                    ELSE COALESCE(failed_count, 0)
                END
            WHERE success_count IS NULL OR failed_count IS NULL
            """
        )
    )


async def sync_plan_quotas():
    async with async_session() as session:
        await session.execute(
            text(
                """
                UPDATE users
                SET
                    image_quota_used = COALESCE((SELECT used_quota FROM quotas WHERE quotas.user_id = users.id), image_quota_used, 0),
                    image_quota_total = CASE
                        WHEN vip_level = 'vip1' THEN :vip1_quota
                        WHEN vip_level = 'vip2' AND promo_vip2_used IS TRUE THEN :promo_vip2_quota
                        WHEN vip_level = 'vip2' THEN :vip2_quota
                        WHEN vip_level = 'vip3' THEN :vip3_quota
                        WHEN plan = 'pro' THEN :pro_quota
                        ELSE :free_quota
                    END
                """
            ),
            {
                "free_quota": FREE_MONTHLY_QUOTA,
                "pro_quota": PRO_MONTHLY_QUOTA,
                "vip1_quota": VIP1_IMAGE_QUOTA,
                "vip2_quota": VIP2_IMAGE_QUOTA,
                "promo_vip2_quota": VIP2_IMAGE_QUOTA + PROMO_VIP2_BONUS_QUOTA,
                "vip3_quota": VIP3_IMAGE_QUOTA,
            },
        )
        await session.execute(
            text(
                """
                UPDATE users
                SET
                    image_quota_used = COALESCE(image_quota_used, 0),
                    image_quota_remaining = CASE
                        WHEN image_quota_total - COALESCE(image_quota_used, 0) < 0 THEN 0
                        ELSE image_quota_total - COALESCE(image_quota_used, 0)
                    END
                """
            )
        )
        await session.execute(
            text(
                """
                UPDATE quotas
                SET
                    total_quota = COALESCE((SELECT image_quota_total FROM users WHERE users.id = quotas.user_id), :free_quota),
                    used_quota = COALESCE((SELECT image_quota_used FROM users WHERE users.id = quotas.user_id), 0)
                """
            ),
            {"free_quota": FREE_MONTHLY_QUOTA},
        )
        await session.commit()


async def close_db():
    await engine.dispose()
