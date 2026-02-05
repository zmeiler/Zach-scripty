# Dispensary Aggregator Monorepo

This project aggregates dispensary product, price, and review data into one live dashboard that updates continuously (stock ticker style).

## What now updates live

- Backend scheduler polls each configured source repeatedly.
- `GET /stream` publishes Server-Sent Events in real time.
- Frontend listens to `/stream` and updates:
  - live price rows
  - rolling review feed
  - moving ticker tape at the top of the page

## Pennsylvania directory data

- `apps/api/data/pa_medical_dispensaries.json` contains PA medical dispensary locations.
- `GET /pa-dispensaries` serves this directory for the table in the web UI.

## API/provider integration (Dutchie/Jane/generic)

Each PA location becomes a `DispensarySource`. By default sources use mock data. To connect real APIs, edit:

- `apps/api/config/provider_overrides.json`

Each override key must be the source id (format: `pa-<permittee>-<location>-<city>` slug).

Example override:

```json
{
  "pa-rise-carlisle-carlisle": {
    "provider": "generic",
    "crawl_interval_seconds": 20,
    "provider_config": {
      "catalog_endpoint": "https://your-api/catalog",
      "prices_endpoint": "https://your-api/prices",
      "reviews_endpoint": "https://your-api/reviews",
      "api_token": "your-token"
    }
  }
}
```

### How to find API endpoints for a dispensary site

1. Open that dispensary website in browser devtools.
2. Go to **Network** tab and filter by **Fetch/XHR**.
3. Refresh page and look for JSON endpoints returning menu/products/pricing/reviews.
4. Copy those endpoint URLs into `provider_overrides.json`.
5. If auth is required, add token in `api_token`.
6. Restart API service.

## Run locally

```bash
python -m venv .venv
source .venv/bin/activate
pip install -r apps/api/requirements.txt
python -m uvicorn apps.api.main:app --host 0.0.0.0 --port 8000 --reload
```

In a second terminal:

```bash
python -m http.server 4173 --directory apps/web
```

Open `http://localhost:4173`.

## Quick checks

- `GET /health` -> service and source count
- `GET /providers` -> provider mode per source
- `GET /events?limit=20` -> most recent ingested records
- `GET /stream` -> live SSE updates
