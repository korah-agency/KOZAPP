from uuid import UUID

from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.api.deps import get_current_profile, get_db_session
from app.models.profile import Profile
from app.models.team_member import TeamMember
from app.schemas.team import TeamMemberInvite, TeamMemberRead

router = APIRouter(prefix="/api/team", tags=["team"])


@router.get("/", response_model=list[TeamMemberRead])
async def list_team(
    db: AsyncSession = Depends(get_db_session),
    current_profile: Profile = Depends(get_current_profile),
):
    result = await db.execute(
        select(TeamMember).where(TeamMember.profile_id == current_profile.id).order_by(TeamMember.invited_at)
    )
    return [TeamMemberRead.model_validate(m) for m in result.scalars().all()]


@router.post("/", response_model=TeamMemberRead, status_code=status.HTTP_201_CREATED)
async def invite_member(
    body: TeamMemberInvite,
    db: AsyncSession = Depends(get_db_session),
    current_profile: Profile = Depends(get_current_profile),
):
    existing = await db.execute(
        select(TeamMember).where(
            TeamMember.profile_id == current_profile.id, TeamMember.email == body.email
        )
    )
    if existing.scalar_one_or_none():
        raise HTTPException(status_code=status.HTTP_409_CONFLICT, detail="Ce membre est déjà invité")

    member = TeamMember(
        profile_id=current_profile.id, email=body.email, name=body.name, role=body.role
    )
    db.add(member)
    await db.flush()
    await db.refresh(member)
    return TeamMemberRead.model_validate(member)


@router.delete("/{member_id}", status_code=status.HTTP_204_NO_CONTENT)
async def remove_member(
    member_id: UUID,
    db: AsyncSession = Depends(get_db_session),
    current_profile: Profile = Depends(get_current_profile),
):
    result = await db.execute(
        select(TeamMember).where(TeamMember.id == member_id, TeamMember.profile_id == current_profile.id)
    )
    member = result.scalar_one_or_none()
    if not member:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Membre non trouve")
    await db.delete(member)
