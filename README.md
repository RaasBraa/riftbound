# Riftbound Archive

A static online card database for [Riftbound](https://playriftbound.com/en-us/card-gallery). Search the official catalog, then track how many copies you own so you can check from your phone at a game store.

This started from [Gummyosh1/card-database-template](https://github.com/Gummyosh1/card-database-template) and the [How to Make a Riftbound Card Database](https://www.youtube.com/watch?v=Xdtu-sNbTII) workflow. The catalog now loads all official cards (Origins, Proving Grounds, Spiritforged, Unleashed, Vendetta) and uses Riot's gallery images instead of one-by-one PNG downloads.

## Run it locally

Do not open `index.html` as a file. Serve this folder, then visit the local URL:

- VS Code / Cursor: install Live Server and click Go Live
- Or any static server pointed at this project root

## Browse vs editing

Anyone can open the site and see Ras's collection. **+ / −**, import, and export stay locked until you click **Unlock editing** and enter the vault key.

The key hash lives in `config.js`. To change it:

```bash
python -c "import hashlib; print(hashlib.sha256(('ras-brandt-riftbound-vault'+'YOURPASSWORD').encode()).hexdigest())"
```

Edits are saved in this browser. To update what visitors see, export `collection.json`, replace `data/collection.json`, and push.

## Track your collection

- Use **+ / −** on a card to change how many copies you own
- Quantities are saved in this browser (`localStorage`)
- **Owned** / **Missing** filters help while sorting bulk
- **Export collection** downloads a `cards.csv` compatible with the original template
- **Import CSV** loads that file, or a CSV you built with the Python add scripts in `riftbound/`

## Refresh the official catalog

When a new set hits the [official gallery](https://playriftbound.com/en-us/card-gallery), run:

```bash
python scripts/fetch_cards.py
```

That writes `data/cards.json`. Commit the file if you want GitHub Pages to pick it up.

## Publish with GitHub Pages

1. Push this repo to GitHub
2. Settings → Pages → Source: **Deploy from a branch** → `main` / `/ (root)`
3. After it builds, open the Pages URL on your phone

## Original add scripts

The Python helpers in `riftbound/` still work if you prefer typing cards into `riftbound/cards.csv`. The site will import that CSV the first time a browser has an empty collection.

```bash
cd riftbound
python cardadd-ogn.py   # Origins
python cardadd-sfd.py   # Spiritforged
python cardadd-unl.py   # Unleashed
python cardadd.py       # any set
```

## Disclaimer

Riftbound, League of Legends, and related marks are trademarks of Riot Games, Inc. This project is unofficial and not endorsed by Riot. Card data and images are sourced from the official gallery.
