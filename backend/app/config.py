from functools import lru_cache

from pydantic_settings import BaseSettings


class Settings(BaseSettings):
    # Connexion base de donnees (obligatoire). Sur Supabase, utiliser le
    # pooler asyncpg ; en local, une base Postgres classique convient.
    DATABASE_URL: str

    # Facultatif : uniquement necessaire si le code appelle un jour le
    # client Supabase (stockage, etc.) en plus de la connexion SQL directe.
    SUPABASE_URL: str | None = None
    SUPABASE_ANON_KEY: str | None = None
    SUPABASE_SERVICE_ROLE_KEY: str | None = None

    # Verify token global (handshake webhook Meta au niveau de l'app
    # Tech Provider). Le token d'envoi et le phone_number_id, eux, sont
    # propres a chaque commercant (voir profiles.whatsapp_token /
    # profiles.whatsapp_phone_number_id) car chaque boutique connecte son
    # propre compte WhatsApp Business.
    WHATSAPP_VERIFY_TOKEN: str = "change_me_verify_token"
    WHATSAPP_API_VERSION: str = "v21.0"
    # App Secret Meta (Developer Portal > Parametres > Basique). Sert a verifier
    # la signature HMAC (X-Hub-Signature-256) de chaque webhook entrant -- sans
    # elle, n'importe qui connaissant l'URL du webhook peut injecter de faux
    # messages et declencher de vraies commandes.
    WHATSAPP_APP_SECRET: str = ""

    # Passerelle OpenRouter (moteur de l'agent). Cle sur openrouter.ai/keys.
    OPENROUTER_API_KEY: str = ""
    OPENROUTER_BASE_URL: str = "https://openrouter.ai/api/v1"
    # Modeles par defaut ; le slug exact est a confirmer sur openrouter.ai/models
    # au moment du deploiement (nommage susceptible d'evoluer). profiles.agent_model
    # peut surcharger ce choix par boutique (paliers superieurs).
    AGENT_MODEL_DEFAULT: str = "google/gemini-2.5-flash-lite"
    AGENT_MODEL_PREMIUM: str = "google/gemini-2.5-flash"
    AGENT_MAX_TOOL_ITERATIONS: int = 6
    AGENT_SUMMARY_TRIGGER_MESSAGES: int = 20

    ENVIRONMENT: str = "development"
    SECRET_KEY: str = "change_me"
    JWT_ALGORITHM: str = "HS256"
    JWT_EXPIRE_MINUTES: int = 60 * 24 * 7
    ALLOWED_ORIGINS: str = "http://localhost:3000"
    # Utilise pour construire le lien envoye dans l'e-mail de reinitialisation
    FRONTEND_URL: str = "http://localhost:3000"

    @property
    def allowed_origins_list(self) -> list[str]:
        return [o.strip() for o in self.ALLOWED_ORIGINS.split(",") if o.strip()]

    model_config = {"env_file": ".env", "env_file_encoding": "utf-8"}


@lru_cache
def get_settings() -> Settings:
    return Settings()


settings = get_settings()
