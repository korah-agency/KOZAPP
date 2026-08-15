import logging
from contextlib import asynccontextmanager
from pathlib import Path

from fastapi import FastAPI, Request
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import JSONResponse
from fastapi.staticfiles import StaticFiles
from slowapi import Limiter, _rate_limit_exceeded_handler
from slowapi.errors import RateLimitExceeded
from slowapi.middleware import SlowAPIMiddleware
from slowapi.util import get_remote_address

from app.api.analytics import router as analytics_router
from app.api.auth import router as auth_router
from app.api.categories import router as categories_router
from app.api.customers import router as customers_router
from app.api.negotiation import router as negotiation_router
from app.api.orders import router as orders_router
from app.api.products import router as products_router
from app.api.team import router as team_router
from app.api.webhooks import router as webhooks_router
from app.config import settings
from app.database import init_db

logger = logging.getLogger(__name__)


@asynccontextmanager
async def lifespan(app: FastAPI):
    logger.info("Starting Kozapp API - environment: %s", settings.ENVIRONMENT)
    await init_db()
    logger.info("Database initialized")
    yield
    logger.info("Shutting down Kozapp API")


app = FastAPI(
    title="Kozapp API",
    description="Backend API for Kozapp - WhatsApp ordering system",
    version="1.0.0",
    lifespan=lifespan,
)

limiter = Limiter(key_func=get_remote_address)
app.state.limiter = limiter
app.add_exception_handler(RateLimitExceeded, _rate_limit_exceeded_handler)
app.add_middleware(SlowAPIMiddleware)

app.add_middleware(
    CORSMiddleware,
    allow_origins=settings.allowed_origins_list,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

UPLOADS_DIR = Path(__file__).resolve().parent.parent / "uploads"
UPLOADS_DIR.mkdir(exist_ok=True)
app.mount("/uploads", StaticFiles(directory=str(UPLOADS_DIR)), name="uploads")

app.include_router(auth_router)
app.include_router(webhooks_router)
app.include_router(orders_router)
app.include_router(products_router)
app.include_router(categories_router)
app.include_router(negotiation_router)
app.include_router(team_router)
app.include_router(customers_router)
app.include_router(analytics_router)


@app.exception_handler(Exception)
async def unhandled_exception_handler(request: Request, exc: Exception):
    """Filet de securite : ne jamais renvoyer un message technique/trace au
    client. L'erreur reelle est journalisee cote serveur pour le diagnostic."""
    logger.exception("Erreur non geree sur %s %s", request.method, request.url.path)
    return JSONResponse(
        status_code=500,
        content={"detail": "Une erreur est survenue de notre côté. Réessayez dans un instant."},
    )


@app.get("/health")
async def health_check():
    return {"status": "healthy", "service": "kozapp-api"}
