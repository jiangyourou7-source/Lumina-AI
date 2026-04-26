from sqlalchemy.ext.asyncio import create_async_engine, AsyncSession, async_sessionmaker
from sqlalchemy import text
from models.database import Base
from core.config import DATABASE_URL, FREE_MONTHLY_QUOTA, PRO_MONTHLY_QUOTA

engine = create_async_engine(DATABASE_URL, echo=False)
async_session = async_sessionmaker(engine, class_=AsyncSession, expire_on_commit=False)


async def get_db():
    async with async_session() as session:
        yield session


async def init_db():
    async with engine.begin() as conn:
        await conn.run_sync(Base.metadata.create_all)
    await sync_plan_quotas()


async def sync_plan_quotas():
    async with async_session() as session:
        await session.execute(
            text(
                """
                UPDATE quotas
                SET
                    total_quota = :free_quota,
                    used_quota = CASE
                        WHEN used_quota > :free_quota THEN :free_quota
                        ELSE used_quota
                    END
                WHERE user_id IN (SELECT id FROM users WHERE plan = 'free')
                  AND total_quota != :free_quota
                """
            ),
            {"free_quota": FREE_MONTHLY_QUOTA},
        )
        await session.execute(
            text(
                """
                UPDATE quotas
                SET
                    total_quota = :pro_quota,
                    used_quota = CASE
                        WHEN used_quota > :pro_quota THEN :pro_quota
                        ELSE used_quota
                    END
                WHERE user_id IN (SELECT id FROM users WHERE plan = 'pro')
                  AND total_quota != :pro_quota
                """
            ),
            {"pro_quota": PRO_MONTHLY_QUOTA},
        )
        await session.commit()


async def close_db():
    await engine.dispose()
