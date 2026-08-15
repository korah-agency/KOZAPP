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
