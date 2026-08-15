import logging
from datetime import datetime, timedelta, timezone

from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy import select, text
from sqlalchemy.ext.asyncio import AsyncSession

from app.api.deps import (
    create_access_token,
    generate_reset_token,
    get_current_profile,
    get_db_session,
    hash_password,
    hash_reset_token,
    verify_password,
)
from app.config import settings
from app.models.profile import Profile
from app.schemas.auth import (
    ChangePasswordRequest,
    ForgotPasswordRequest,
    LoginRequest,
    MessageResponse,
    RegisterRequest,
    ResetPasswordRequest,
    TokenResponse,
)
from app.schemas.profile import ProfileRead, ProfileUpdate

logger = logging.getLogger(__name__)
router = APIRouter(prefix="/api/auth", tags=["auth"])

RESET_TOKEN_VALID_MINUTES = 60


@router.post("/register", response_model=TokenResponse, status_code=status.HTTP_201_CREATED)
async def register(
    body: RegisterRequest,
    db: AsyncSession = Depends(get_db_session),
):
    result = await db.execute(select(Profile).where(Profile.email == body.email))
    if result.scalar_one_or_none():
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail="Un compte existe déjà avec cet e-mail",
        )
    profile = Profile(
        email=body.email,
        password_hash=hash_password(body.password),
        shop_name=body.shop_name,
        activity_type=body.activity_type,
    )
    db.add(profile)
    await db.flush()
    await db.refresh(profile)
    return TokenResponse(access_token=create_access_token(profile.id))


@router.post("/login", response_model=TokenResponse)
async def login(
    body: LoginRequest,
    db: AsyncSession = Depends(get_db_session),
):
    result = await db.execute(select(Profile).where(Profile.email == body.email))
    profile = result.scalar_one_or_none()
    if not profile or not verify_password(body.password, profile.password_hash):
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="E-mail ou mot de passe incorrect",
        )
    if not profile.is_active:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Ce compte est désactivé",
        )
    return TokenResponse(access_token=create_access_token(profile.id))


@router.get("/me", response_model=ProfileRead)
async def me(current_profile: Profile = Depends(get_current_profile)):
    return ProfileRead.model_validate(current_profile)


@router.patch("/me", response_model=ProfileRead)
async def update_me(
    body: ProfileUpdate,
    db: AsyncSession = Depends(get_db_session),
    current_profile: Profile = Depends(get_current_profile),
):
    update_data = body.model_dump(exclude_unset=True)
    for field, value in update_data.items():
        setattr(current_profile, field, value)
    await db.flush()
    await db.refresh(current_profile)
    return ProfileRead.model_validate(current_profile)


@router.post("/change-password", response_model=MessageResponse)
async def change_password(
    body: ChangePasswordRequest,
    db: AsyncSession = Depends(get_db_session),
    current_profile: Profile = Depends(get_current_profile),
):
    if not verify_password(body.current_password, current_profile.password_hash):
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Mot de passe actuel incorrect",
        )
    current_profile.password_hash = hash_password(body.new_password)
    await db.flush()
    return MessageResponse(message="Votre mot de passe a été mis à jour.")


@router.post("/forgot-password", response_model=MessageResponse)
async def forgot_password(
    body: ForgotPasswordRequest,
    db: AsyncSession = Depends(get_db_session),
):
    """Genere un lien de reinitialisation si le compte existe. La reponse
    est volontairement identique dans tous les cas pour ne pas reveler
    quels e-mails sont enregistres."""
    result = await db.execute(select(Profile).where(Profile.email == body.email))
    profile = result.scalar_one_or_none()

    if profile and profile.is_active:
        token, token_hash = generate_reset_token()
        await db.execute(
            text("SELECT set_config('app.current_profile_id', :pid, true)"), {"pid": str(profile.id)}
        )
        profile.reset_token_hash = token_hash
        profile.reset_token_expires_at = datetime.now(timezone.utc) + timedelta(minutes=RESET_TOKEN_VALID_MINUTES)
        await db.flush()

        reset_link = f"{settings.FRONTEND_URL}/auth/reset-password?token={token}"
        # Aucun service d'envoi d'e-mail n'est configure pour l'instant :
        # le lien est journalise cote serveur pour permettre les tests.
        logger.warning("Lien de réinitialisation pour %s (aucun service e-mail configuré) : %s", body.email, reset_link)

    return MessageResponse(message="Si un compte existe avec cet e-mail, un lien de réinitialisation a été généré.")


@router.post("/reset-password", response_model=MessageResponse)
async def reset_password(
    body: ResetPasswordRequest,
    db: AsyncSession = Depends(get_db_session),
):
    token_hash = hash_reset_token(body.token)
    result = await db.execute(select(Profile).where(Profile.reset_token_hash == token_hash))
    profile = result.scalar_one_or_none()

    now = datetime.now(timezone.utc)
    if not profile or not profile.reset_token_expires_at or profile.reset_token_expires_at < now:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Ce lien de réinitialisation est invalide ou a expiré. Redemandez-en un.",
        )

    await db.execute(
        text("SELECT set_config('app.current_profile_id', :pid, true)"), {"pid": str(profile.id)}
    )
    profile.password_hash = hash_password(body.new_password)
    profile.reset_token_hash = None
    profile.reset_token_expires_at = None
    await db.flush()
    return MessageResponse(message="Votre mot de passe a été mis à jour. Vous pouvez maintenant vous connecter.")
