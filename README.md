# Zachary Live Package Ticker

A command-line package tracker that gives a stock-market style live ticker for:

- Amazon packages
- eBay packages
- Other websites (generic provider support)

It starts with your requested default profile:

- Name: Zachary Meiler
- Address: 23 bloomingdale ct, york, pa 17402-2606

> Note: The Amazon/eBay providers in this implementation are simulated status feeds so the app works out of the box without private APIs/credentials. The architecture is pluggable so you can replace provider modules with real API integrations later.

## Run

```bash
python run_tracker.py watch
```

## Add tracker entries

```bash
python run_tracker.py add amazon AMZ-123 "Gaming Mouse"
python run_tracker.py add ebay EBY-999 "Vintage Card"
python run_tracker.py add etsy ETSY-44 "Handmade Mug" --url "https://example.com/track"
```

## Profile

```bash
python run_tracker.py profile-show
python run_tracker.py profile-set --name "Zachary Meiler" --address1 "23 bloomingdale ct" --city "york" --state "pa" --zip "17402-2606"
```

Config persists at:

- `~/.zachary_tracker/config.json`
