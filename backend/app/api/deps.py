import hashlib
import secrets
import uuid
from collections.abc import AsyncGenerator
from datetime import datetime, timedelta, timezone

import jwt
from fastapi import Depends, Header, HTTPException, status
from passlib.context import CryptContext
from sqlalchemy import select, text
from sqlalchemy.ext.asyncio import AsyncSession

from app.config import settings
from app.database import get_db
from app.models.profile import Profile

pwd_context = CryptContext(schemes=["bcrypt"], deprecated="auto")


def hash_password(password: str) -> str:
    return pwd_context.hash(password)


def verify_password(password: str, password_hash: str) -> bool:
    try:
        return pwd_context.verify(password, password_hash)
    except ValueError:
        # Hash malforme ou provenant d'un autre schema (ex. donnees de seed
        # placeholder) : on refuse proprement plutot que de faire planter
        # la connexion.
        return False


def create_access_token(profile_id: uuid.UUID) -> str:
    expire = datetime.now(timezone.utc) + timedelta(minutes=settings.JWT_EXPIRE_MINUTES)
    payload = {"sub": str(profile_id), "exp": expire}
    return jwt.encode(payload, settings.SECRET_KEY, algorithm=settings.JWT_ALGORITHM)


def decode_access_token(token: str) -> uuid.UUID:
    try:
        payload = jwt.decode(token, settings.SECRET_KEY, algorithms=[settings.JWT_ALGORITHM])
        return uuid.UUID(payload["sub"])
    except (jwt.PyJWTError, KeyError, ValueError) as exc:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Session invalide ou expirée, reconnectez-vous",
        ) from exc


def generate_reset_token() -> tuple[str, str]:
    """Retourne (token en clair a transmettre au commercant, hash SHA-256 a
    stocker en base). On ne stocke jamais le token en clair : comme un mot
    de passe, s'il fuitait depuis la base il ne doit pas etre directement
    utilisable."""
    token = secrets.token_urlsafe(32)
    return token, hashlib.sha256(token.encode()).hexdigest()


def hash_reset_token(token: str) -> str:
    return hashlib.sha256(token.encode()).hexdigest()


async def get_db_session() -> AsyncGenerator[AsyncSession, None]:
    async for session in get_db():
        yield session


async def get_current_profile(
    authorization: str | None = Header(None),
    db: AsyncSession = Depends(get_db_session),
) -> Profile:
    """Verifie le JWT, charge le profil authentifie, et positionne la
    variable de session Postgres que les policies RLS utilisent pour
    isoler les donnees de ce tenant (voir schema section 8)."""
    if not authorization or not authorization.lower().startswith("bearer "):
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Authentification requise",
            headers={"WWW-Authenticate": "Bearer"},
        )
    token = authorization.split(" ", 1)[1]
    profile_id = decode_access_token(token)

    result = await db.execute(select(Profile).where(Profile.id == profile_id))
    profile = result.scalar_one_or_none()
    if not profile or not profile.is_active:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Compte introuvable ou désactivé",
        )

    await db.execute(
        text("SELECT set_config('app.current_profile_id', :pid, true)"), {"pid": str(profile.id)}
    )
    return profile


async def verify_webhook_token(
    hub_mode: str = Header(None, alias="X-Hub-Mode"),
    hub_verify_token: str = Header(None, alias="X-Hub-Verify-Token"),
) -> str:
    if hub_mode == "subscribe" and hub_verify_token == settings.WHATSAPP_VERIFY_TOKEN:
        return hub_verify_token
    raise HTTPException(
        status_code=status.HTTP_403_FORBIDDEN,
        detail="Invalid webhook verification token",
    )


def verify_admin_api_key(
    x_api_key: str | None = Header(None),
) -> None:
    if x_api_key and x_api_key == settings.SECRET_KEY:
        return
    raise HTTPException(
        status_code=status.HTTP_401_UNAUTHORIZED,
        detail="Invalid or missing API key",
    )
