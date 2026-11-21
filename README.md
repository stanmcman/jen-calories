# Nibbles & Bits

A private calorie tracker for iPhone, built as an installable web app (PWA).

**Live app:** https://stanmcman.github.io/jen-calories/

- Everything is stored on the phone (IndexedDB). No accounts, no server.
- AI photo/text/recipe estimates use the Anthropic API with the user's own key (entered in the app, never stored here).
- Barcode scanning uses Open Food Facts; food search uses USDA FoodData Central.

## Making changes

The easiest way: open Claude Code, point it at this repository, and describe the change you want.
Every push to `main` rebuilds and republishes the app automatically (see `.github/workflows/deploy.yml`);
the phone picks up the new version the next time the app is opened (sometimes it takes a second open).

## Running it on a computer

```bash
npm install
npm run dev
```

Then open the address it prints. `npm run build` makes the production version in `dist/`.

## Where things are

| Path | What it is |
|---|---|
| `src/screens/` | Each screen (Today/day view, History, Weight, More, Recipes, Favorites, settings) |
| `src/components/` | Shared pieces (add-food sheet, progress ring, weight chart, scanner) |
| `src/lib/calc.ts` | Goal calculator (Mifflin-St Jeor, activity factors, safe minimums) |
| `src/lib/ai.ts` | Claude calls, prompts, photo compression |
| `src/lib/foods.ts` | Open Food Facts and USDA lookups |
| `src/lib/backup.ts` | Backup and restore |
| `src/db.ts` | The on-device database |
| `src/index.css` | Colors, fonts, and layout |
