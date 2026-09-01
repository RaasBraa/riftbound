# Riftbound Archive

A static online card database for [Riftbound](https://playriftbound.com/en-us/card-gallery). The GitHub Pages site is view-only. Counts live in `data/collection.json`.

## Best way to add a lot of cards

Do **not** tap +/− a thousand times on the gallery. Use the local **card intake** page.

```bash
python scripts/local_server.py
```

- Computer: http://127.0.0.1:4173/intake.html
- Phone camera on the same Wi‑Fi: the terminal prints a `Phone camera` URL

**Fastest for ~1000 cards:** sort the pile, type the first few letters of the name, press Enter. Repeat. Undo is there if you miss.

**Voice (best with a weak webcam):** on intake, click **Start listening** in Chrome or Edge, then say the card name. The card art pops in with a +1 stamp on every add, including the same card twice. Say **undo** if it grabs the wrong one. If several printings share a name, tap the right art.

**Phone:** open the `Phone camera` URL and use **Take photo**. Live video is often blocked on `http://`. Anyone on your Wi‑Fi can write `collection.json` while the local server is running.

**CSV:** if you already scanned in another Riftbound app, export CSV and import it from the archive editor.

Then publish:

```bash
git add data/collection.json
git commit -m "Update collection"
git push
```

## Refresh the official catalog

```bash
python scripts/fetch_cards.py
```

This also adds rune reprints the official gallery skips (Spiritforged, Unleashed, Vendetta showcase/promo, and Origins `b` promos). Commit `data/cards.json` and push.

## Collection value (local editor)

The local editor stores **TCGplayer** prices from [RiftCompare](https://riftcompare.com/) (the US TCGplayer row, in USD). That is not Cardmarket and not the cheapest EU listing.

```bash
python scripts/fetch_prices.py
```

Or click **Refresh prices** while the local server is running. The **TCG value** stat is copies × TCGplayer listing. Sort by **TCGplayer** to see the expensive cards first.

## Disclaimer

Riftbound, League of Legends, and related marks are trademarks of Riot Games, Inc. This project is unofficial and not endorsed by Riot. Card data and images are sourced from the official gallery.
