# Bunny Stream uploader

## Setup
1. Copy `.env.example` to `.env` and fill in your Bunny Stream values.
2. Run the script with Node.js:

```bash
node scripts/bunny-upload.js --input nftData.json --output nftData.json
```

## Required env vars
- `BUNNY_LIBRARY_ID`
- `BUNNY_ACCESS_KEY`

## Optional env vars
- `BUNNY_PULL_ZONE` (adds `bunnyVideoUrl` to each NFT record)
