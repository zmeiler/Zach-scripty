from __future__ import annotations

from contextlib import asynccontextmanager
from pathlib import Path

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import StreamingResponse

from apps.api.data.pa_loader import build_sources_from_pa_data, load_pa_medical_dispensaries, load_provider_overrides
from apps.api.ingestion.scheduler import IngestionScheduler
from apps.api.realtime.broker import EventBroker
from apps.api.storage.repository import Repository
from packages.shared.contracts import PennsylvaniaMedicalDispensary

BASE_DIR = Path(__file__).resolve().parent
DATA_DIR = BASE_DIR / "data"
CONFIG_DIR = BASE_DIR / "config"
PA_DISPENSARY_FILE = DATA_DIR / "pa_medical_dispensaries.json"
PROVIDER_OVERRIDES_FILE = CONFIG_DIR / "provider_overrides.json"

pa_dispensary_records = load_pa_medical_dispensaries(PA_DISPENSARY_FILE)
provider_overrides = load_provider_overrides(PROVIDER_OVERRIDES_FILE)
pa_dispensaries = [PennsylvaniaMedicalDispensary(**item) for item in pa_dispensary_records]
sources = build_sources_from_pa_data(pa_dispensary_records, provider_overrides=provider_overrides)

repository = Repository(DATA_DIR)
broker = EventBroker()
scheduler = IngestionScheduler(repository=repository, broker=broker, sources=sources)


@asynccontextmanager
async def lifespan(_: FastAPI):
    await scheduler.start()
    try:
        yield
    finally:
        await scheduler.stop()


app = FastAPI(title="Dispensary Aggregator API", lifespan=lifespan)
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)


@app.get("/health")
async def health() -> dict:
    return {
        "status": "ok",
        "sources": len(sources),
        "pa_medical_dispensaries": len(pa_dispensaries),
        "provider_overrides": len(provider_overrides),
    }


@app.get("/providers")
async def providers() -> list[dict]:
    return [
        {
            "source_id": source.id,
            "name": source.name,
            "provider": source.provider,
            "base_url": str(source.base_url),
            "configured": bool(source.provider_config),
        }
        for source in sources
    ]


@app.get("/events")
async def events(limit: int = 30) -> list[dict]:
    return [event.model_dump(mode="json") for event in repository.recent_events(limit)]


@app.get("/source-health")
async def source_health() -> list[dict]:
    return repository.source_health()


@app.get("/pa-dispensaries")
async def pa_dispensary_directory() -> list[dict]:
    return [dispensary.model_dump(mode="json") for dispensary in pa_dispensaries]


@app.get("/stream")
async def stream() -> StreamingResponse:
    queue = broker.subscribe()

    async def event_generator():
        try:
            while True:
                event = await queue.get()
                yield f"data: {event}\n\n"
        finally:
            broker.unsubscribe(queue)

    return StreamingResponse(event_generator(), media_type="text/event-stream")
