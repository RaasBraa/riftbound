# Riftbound Archive

A static online card database for [Riftbound](https://playriftbound.com/en-us/card-gallery). The GitHub Pages site is view-only, so you can check Ras's collection from a phone. Counts live in `data/collection.json`.

## Update the collection locally

Start the local editor (don't open `index.html` as a file):

```bash
python scripts/local_server.py
```

Then open http://127.0.0.1:4173

- **+ / −** writes `data/collection.json` automatically
- Import CSV if you still have the old template file
- When the counts look right:

```bash
git add data/collection.json
git commit -m "Update collection"
git push
```

GitHub Pages will show the new numbers after it rebuilds.

## Refresh the official catalog

When a new set hits the [official gallery](https://playriftbound.com/en-us/card-gallery):

```bash
python scripts/fetch_cards.py
```

Commit `data/cards.json` and push.

## Disclaimer

Riftbound, League of Legends, and related marks are trademarks of Riot Games, Inc. This project is unofficial and not endorsed by Riot. Card data and images are sourced from the official gallery.
