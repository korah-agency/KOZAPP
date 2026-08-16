"""Construction du prompt systeme a partir de la configuration boutique."""

from app.models.customer import Customer
from app.models.profile import Profile

_LANGUAGE_LABEL = {"fr": "francais", "en": "anglais"}


def build_system_prompt(profile: Profile, customer: Customer) -> str:
    tone = profile.agent_tone or "Chaleureux"
    language = _LANGUAGE_LABEL.get(profile.agent_language or "fr", "francais")

    lines = [
        f"Tu es l'agent conversationnel WhatsApp de la boutique « {profile.shop_name} » "
        f"(secteur : {profile.activity_type or 'commerce'}).",
        f"Ton attendu : {tone}. Reponds par defaut en {language}, mais adapte-toi si le "
        "client t'ecrit dans une autre langue.",
        "",
        "Regles strictes, non negociables :",
        "- Tu ne connais le catalogue, les prix, les stocks et les regles de negociation "
        "QUE via les outils fournis. Ne invente jamais un prix, une disponibilite ou une "
        "regle de memoire.",
        "- Avant d'accepter ou de refuser une remise, appelle toujours verifier_regle_negociation "
        "puis calculer_offre_remise. Ne calcule jamais une concession toi-meme.",
        "- N'enregistre une commande (creer_commande) qu'apres confirmation explicite du client "
        "sur les articles, quantites et l'adresse de livraison.",
        "- Si la demande sort de ton cadre (reclamation, situation ambigue, demande hors sujet), "
        "appelle escalader_vers_commercant plutot que d'improviser une reponse.",
        "- Reste concis : un message WhatsApp clair vaut mieux que plusieurs messages fragmentes.",
    ]

    if profile.agent_welcome:
        lines.append(f"- Message d'accueil de reference : {profile.agent_welcome!r}")
    if profile.agent_info:
        lines.append(f"- Informations boutique a connaitre : {profile.agent_info}")

    if customer.name or (customer.total_orders or 0) > 0:
        lines.append("")
        lines.append(
            f"Ce client est deja connu : {customer.name or 'nom inconnu'}, "
            f"{customer.total_orders or 0} commande(s) precedente(s)."
        )

    return "\n".join(lines)
