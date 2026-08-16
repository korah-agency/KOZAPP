from sqlalchemy import text
from sqlalchemy.ext.asyncio import AsyncSession, async_sessionmaker, create_async_engine
from sqlalchemy.orm import DeclarativeBase

from app.config import settings

engine = create_async_engine(
    settings.DATABASE_URL,
    echo=False,
    pool_pre_ping=True,
    # Le pooler Supabase en mode "Transaction" (pgbouncer) ne garde pas la
    # session assez longtemps pour les prepared statements qu'asyncpg cree
    # par defaut -> DuplicatePreparedStatementError des la 2e requete sur
    # une connexion reutilisee. statement_cache_size=0 desactive ce cache
    # cote client (asyncpg re-prepare chaque requete), seule option fiable
    # tant qu'on passe par un pooler en mode transaction.
    connect_args={"statement_cache_size": 0},
)
async_session = async_sessionmaker(engine, class_=AsyncSession, expire_on_commit=False)


class Base(DeclarativeBase):
    pass


async def get_db() -> AsyncSession:
    async with async_session() as session:
        try:
            yield session
            await session.commit()
        except Exception:
            await session.rollback()
            raise


async def init_db() -> None:
    """Le schema (tables, index, vues, RLS, seed) est provisionne via
    schema_supabase_whatsapp_orders.sql, pas via Base.metadata.create_all() :
    ce script SQL est la seule source de verite (RLS, triggers, fonctions
    SECURITY DEFINER ne sont pas exprimables par les modeles SQLAlchemy).
    On verifie seulement ici que la connexion fonctionne."""
    async with engine.begin() as conn:
        await conn.execute(text("SELECT 1"))
