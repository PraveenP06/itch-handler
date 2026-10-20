# Book Lab web

Next.js 16, TypeScript, Tailwind and shadcn/ui front end for the order book engine.

- `/` overview, measured speed and what is not claimed
- `/replay` the NASDAQ ITCH trading day of 28 Nov 2025, rebuilt order by order
- `/live` the live Bitcoin book from the C++ engine, with an automatic fall back to a recorded session

## Run
```
npm install
npm run dev
npm test
npm run build
```

## Data
- `public/data/itch-day.json` is produced by `export` in the parent project: `./build/export S112825-v50.txt.gz AAPL,MSFT,NVDA,QQQ,SPY,TSLA 30 itch-day.json`.
- `public/data/live-sample.json` is five minutes of the live engine's real `/book` output.
- Both files are validated with Zod when loaded.

## Live engine
Set `NEXT_PUBLIC_LIVE_URL` (see `.env.example`) to the base URL of a running `live_book`, for example `https://live.example.com`. Start the engine with `--allow-origin https://your-site.vercel.app` so the browser may read it. Without the variable, or when the engine cannot be reached, the page plays the recorded session and says so.

## Deploy on Vercel
Import the repository and set the Root Directory to `web`. The site is fully static, so no server settings are needed.
