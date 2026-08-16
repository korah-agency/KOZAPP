"""Client HTTP minimal pour OpenRouter (API compatible OpenAI).

Pas de SDK dedie : OpenRouter expose une seule route REST
(``/chat/completions``) compatible avec le format OpenAI, ``httpx`` (deja
une dependance du projet) suffit. Voir docs.openrouter.ai pour le format
exact du tool-calling et de l'entree audio multimodale (``input_audio``).
"""

import base64
import logging
from typing import Any

import httpx

from app.config import settings

logger = logging.getLogger(__name__)

OPENROUTER_TIMEOUT = 45.0


class OpenRouterError(Exception):
    pass


def audio_content_part(audio_bytes: bytes, audio_format: str = "ogg") -> dict[str, Any]:
    """Encode un extrait audio (note vocale WhatsApp) pour l'entree
    multimodale du modele -- c'est ce qui remplace une etape de
    transcription separee : le modele (Gemini) comprend l'audio nativement."""
    return {
        "type": "input_audio",
        "input_audio": {
            "data": base64.b64encode(audio_bytes).decode("ascii"),
            "format": audio_format,
        },
    }


async def chat_completion(
    messages: list[dict[str, Any]],
    tools: list[dict[str, Any]] | None = None,
    model: str | None = None,
    temperature: float = 0.4,
) -> dict[str, Any]:
    """Appelle /chat/completions et renvoie le message de l'assistant tel
    que retourne par l'API (peut contenir ``tool_calls``)."""
    if not settings.OPENROUTER_API_KEY:
        raise OpenRouterError("OPENROUTER_API_KEY non configuree")

    payload: dict[str, Any] = {
        "model": model or settings.AGENT_MODEL_DEFAULT,
        "messages": messages,
        "temperature": temperature,
    }
    if tools:
        payload["tools"] = tools
        payload["tool_choice"] = "auto"

    headers = {
        "Authorization": f"Bearer {settings.OPENROUTER_API_KEY}",
        "Content-Type": "application/json",
        # Recommande par OpenRouter pour l'attribution / le classement de l'app.
        "HTTP-Referer": settings.FRONTEND_URL,
        "X-Title": "Kozapp",
    }

    async with httpx.AsyncClient(timeout=OPENROUTER_TIMEOUT) as client:
        try:
            response = await client.post(
                f"{settings.OPENROUTER_BASE_URL}/chat/completions",
                json=payload,
                headers=headers,
            )
            response.raise_for_status()
        except httpx.HTTPStatusError as exc:
            logger.error("OpenRouter error %s: %s", exc.response.status_code, exc.response.text)
            raise OpenRouterError(f"OpenRouter a repondu {exc.response.status_code}") from exc
        except httpx.HTTPError as exc:
            logger.error("OpenRouter unreachable: %s", exc)
            raise OpenRouterError("OpenRouter injoignable") from exc

    data = response.json()
    choices = data.get("choices") or []
    if not choices:
        raise OpenRouterError("Reponse OpenRouter sans choix")
    return choices[0]["message"]
