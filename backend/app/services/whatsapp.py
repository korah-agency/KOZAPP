import logging

import httpx

from app.config import settings

logger = logging.getLogger(__name__)


def _api_base(phone_number_id: str) -> str:
    return f"https://graph.facebook.com/{settings.WHATSAPP_API_VERSION}/{phone_number_id}"


async def send_whatsapp_message(
    phone_number: str,
    message: str,
    token: str,
    phone_number_id: str,
    message_type: str = "text",
) -> dict:
    """Envoie un message WhatsApp via le compte WABA propre au commercant
    (token + phone_number_id obtenus lors de sa connexion Embedded Signup)."""
    url = f"{_api_base(phone_number_id)}/messages"
    payload = {
        "messaging_product": "whatsapp",
        "to": phone_number,
        "type": "text",
        "text": {"body": message},
    }
    headers = {"Authorization": f"Bearer {token}", "Content-Type": "application/json"}
    try:
        async with httpx.AsyncClient(timeout=30.0) as client:
            response = await client.post(url, json=payload, headers=headers)
            response.raise_for_status()
            data = response.json()
            message_id = data.get("messages", [{}])[0].get("id")
            return {"success": True, "message_id": message_id, "error": None}
    except httpx.HTTPStatusError as e:
        logger.error("WhatsApp API error %s: %s", e.response.status_code, e.response.text)
        return {"success": False, "message_id": None, "error": str(e)}
    except Exception as e:
        logger.error("WhatsApp send failed: %s", e)
        return {"success": False, "message_id": None, "error": str(e)}


async def download_whatsapp_media(media_id: str, token: str) -> tuple[bytes, str] | None:
    """Recupere un media entrant (ex. note vocale) : d'abord l'URL signee
    aupres du Graph API, puis le contenu binaire lui-meme. Renvoie
    (contenu, mime_type) ou None en cas d'echec."""
    headers = {"Authorization": f"Bearer {token}"}
    try:
        async with httpx.AsyncClient(timeout=30.0) as client:
            meta_resp = await client.get(
                f"https://graph.facebook.com/{settings.WHATSAPP_API_VERSION}/{media_id}", headers=headers
            )
            meta_resp.raise_for_status()
            media_url = meta_resp.json().get("url")
            if not media_url:
                return None
            file_resp = await client.get(media_url, headers=headers)
            file_resp.raise_for_status()
            mime_type = file_resp.headers.get("content-type", "audio/ogg")
            return file_resp.content, mime_type
    except httpx.HTTPError as e:
        logger.error("Telechargement media WhatsApp echoue (%s): %s", media_id, e)
        return None


async def send_whatsapp_template(
    phone_number: str,
    template_name: str,
    token: str,
    phone_number_id: str,
    language_code: str = "fr",
) -> dict:
    url = f"{_api_base(phone_number_id)}/messages"
    payload = {
        "messaging_product": "whatsapp",
        "to": phone_number,
        "type": "template",
        "template": {"name": template_name, "language": {"code": language_code}},
    }
    headers = {"Authorization": f"Bearer {token}", "Content-Type": "application/json"}
    try:
        async with httpx.AsyncClient(timeout=30.0) as client:
            response = await client.post(url, json=payload, headers=headers)
            response.raise_for_status()
            data = response.json()
            message_id = data.get("messages", [{}])[0].get("id")
            return {"success": True, "message_id": message_id, "error": None}
    except httpx.HTTPStatusError as e:
        logger.error("WhatsApp template error %s: %s", e.response.status_code, e.response.text)
        return {"success": False, "message_id": None, "error": str(e)}
    except Exception as e:
        logger.error("WhatsApp template failed: %s", e)
        return {"success": False, "message_id": None, "error": str(e)}
