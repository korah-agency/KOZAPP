from __future__ import annotations

import re

from pydantic import BaseModel, EmailStr, Field, field_validator

PASSWORD_PATTERN = re.compile(r"^(?=.*[A-Za-z])(?=.*\d).{6,}$")
PASSWORD_HINT = "Le mot de passe doit contenir au moins 6 caractères, avec au moins une lettre et un chiffre."


def _check_password_strength(value: str) -> str:
    if not PASSWORD_PATTERN.match(value):
        raise ValueError(PASSWORD_HINT)
    return value


class RegisterRequest(BaseModel):
    email: EmailStr
    password: str = Field(min_length=6)
    shop_name: str = Field(min_length=1, max_length=255)
    activity_type: str = "restauration"

    @field_validator("password")
    @classmethod
    def validate_password(cls, v: str) -> str:
        return _check_password_strength(v)


class LoginRequest(BaseModel):
    email: EmailStr
    password: str


class TokenResponse(BaseModel):
    access_token: str
    token_type: str = "bearer"


class ForgotPasswordRequest(BaseModel):
    email: EmailStr


class ResetPasswordRequest(BaseModel):
    token: str
    new_password: str = Field(min_length=6)

    @field_validator("new_password")
    @classmethod
    def validate_new_password(cls, v: str) -> str:
        return _check_password_strength(v)


class ChangePasswordRequest(BaseModel):
    current_password: str
    new_password: str = Field(min_length=6)

    @field_validator("new_password")
    @classmethod
    def validate_new_password(cls, v: str) -> str:
        return _check_password_strength(v)


class MessageResponse(BaseModel):
    message: str
