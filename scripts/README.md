# Bunny Stream uploader

## Setup
1. Copy `.env.example` to `.env` and fill in your Bunny Stream values (local runs).
2. Run the script with Node.js:

```bash
node scripts/bunny-upload.js --input nftData.json --output nftData.json
```

## Required env vars
- `BUNNY_LIBRARY_ID`
- `BUNNY_ACCESS_KEY`

## Optional env vars
- `BUNNY_PULL_ZONE` (adds `bunnyVideoUrl` to each NFT record)

## GitHub Actions (no local setup)
You can also run the uploader from GitHub Actions without committing secrets:

1. Go to your repo → **Settings** → **Secrets and variables** → **Actions**.
2. Add secrets:
   - `BUNNY_LIBRARY_ID`
   - `BUNNY_ACCESS_KEY`
   - `BUNNY_PULL_ZONE` (optional)
3. Go to **Actions** → **Upload NFT videos to Bunny Stream** → **Run workflow**.
4. Enter your JSON path (example: `nftData.json`) and run.
5. The workflow will commit the updated JSON back to your repo.
