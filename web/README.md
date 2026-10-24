# Book Lab web

Next.js 16, TypeScript, Tailwind and shadcn/ui front end for the order book engine.

- `/` overview, measured speed and what is not claimed
- `/replay` six NASDAQ ITCH trading days (28 Nov and 8 to 12 Dec 2025), rebuilt order by order
- `/live` the live Bitcoin book from the C++ engine, with an automatic fall back to a recorded session

## Run
```
npm install
npm run dev
npm test
npm run build
```

## Data
- `public/data/days/<date>.json` is produced by `export` in the parent project, for example `./build/export S120825-v50.txt.gz AAPL,MSFT,NVDA,QQQ,SPY,TSLA 30 2025-12-08.json`. Run `node scripts/build-day-index.mjs` afterwards to refresh `index.json`.
- `public/data/live-sample.json` is five minutes of the live engine's real `/book` output.
- Both files are validated with Zod when loaded.

## Live engine
Set `NEXT_PUBLIC_LIVE_URL` (see `.env.example`) to the base URL of a running `live_book`, for example `https://live.example.com`. Start the engine with `--allow-origin https://your-site.vercel.app` so the browser may read it. Without the variable, or when the engine cannot be reached, the page plays the recorded session and says so.

## Deploy on Vercel
Import the repository and set the Root Directory to `web`. The site is fully static, so no server settings are needed.
