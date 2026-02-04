#!/usr/bin/env node
/**
 * Upload NFT video assets to Bunny Stream and write bunnyVideoId/bunnyVideoUrl
 * back into your JSON file.
 *
 * Usage:
 *   node scripts/bunny-upload.js --input nftData.json --output nftData.json
 *
 * Env:
 *   BUNNY_LIBRARY_ID   (required)
 *   BUNNY_ACCESS_KEY   (required)
 *   BUNNY_PULL_ZONE    (optional, used to build bunnyVideoUrl)
 */

const fs = require('fs');
const path = require('path');

const args = process.argv.slice(2);
const getArg = (flag, fallback = '') => {
  const index = args.indexOf(flag);
  if (index === -1 || index === args.length - 1) return fallback;
  return args[index + 1];
};

const INPUT_PATH = getArg('--input', 'nftData.json');
const OUTPUT_PATH = getArg('--output', INPUT_PATH);
const LIMIT = Number(getArg('--limit', '0')) || 0;
const DRY_RUN = args.includes('--dry-run');

const LIBRARY_ID = process.env.BUNNY_LIBRARY_ID;
const ACCESS_KEY = process.env.BUNNY_ACCESS_KEY;
const PULL_ZONE = process.env.BUNNY_PULL_ZONE || '';

if (!LIBRARY_ID || !ACCESS_KEY) {
  console.error('Missing BUNNY_LIBRARY_ID or BUNNY_ACCESS_KEY env vars.');
  process.exit(1);
}

const isVideoUrl = (url) => /\.(mp4|mov)$/i.test(url || '');

const safeJsonParse = (value) => {
  try {
    return JSON.parse(value);
  } catch (error) {
    console.error('Failed to parse JSON:', error);
    process.exit(1);
  }
};

async function isVideoByHead(url) {
  try {
    const response = await fetch(url, { method: 'HEAD' });
    const type = response.headers.get('content-type') || '';
    return type.startsWith('video');
  } catch (error) {
    return false;
  }
}

const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

async function fetchWithRetry(url, options = {}, retries = 3, delayMs = 1000) {
  let lastError;
  for (let attempt = 1; attempt <= retries; attempt += 1) {
    try {
      const response = await fetch(url, options);
      return response;
    } catch (error) {
      lastError = error;
      if (attempt < retries) {
        await sleep(delayMs * attempt);
      }
    }
  }
  throw lastError;
}

async function createBunnyVideo(title) {
  const response = await fetch(`https://video.bunnycdn.com/library/${LIBRARY_ID}/videos`, {
    method: 'POST',
    headers: {
      AccessKey: ACCESS_KEY,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({ title }),
  });

  if (!response.ok) {
    const body = await response.text().catch(() => '');
    throw new Error(`Failed to create Bunny video: ${response.status} ${response.statusText}${body ? ` - ${body}` : ''}`);
  }

  const data = await response.json();
  if (!data.guid) {
    throw new Error('Bunny response missing guid.');
  }
  return data.guid;
}

function getMediaBasename(mediaUrl) {
  if (!mediaUrl) return '';
  try {
    const url = new URL(mediaUrl);
    return path.basename(url.pathname || '');
  } catch (error) {
    return path.basename(mediaUrl);
  }
}

function getBunnyTitle(nft, mediaUrl) {
  const rawTitle = (nft?.name || '').trim();
  if (rawTitle) return rawTitle;

  const basename = getMediaBasename(mediaUrl).trim();
  if (basename) return basename;

  return 'Untitled video';
}

async function uploadVideoToBunny(videoId, buffer) {
  const response = await fetch(`https://video.bunnycdn.com/library/${LIBRARY_ID}/videos/${videoId}`, {
    method: 'PUT',
    headers: {
      AccessKey: ACCESS_KEY,
    },
    body: buffer,
  });

  if (!response.ok) {
    const body = await response.text().catch(() => '');
    throw new Error(`Failed to upload video: ${response.status} ${response.statusText}${body ? ` - ${body}` : ''}`);
  }
}

function buildBunnyUrl(videoId, quality = '480p') {
  if (!PULL_ZONE) return '';
  return `https://${PULL_ZONE}.b-cdn.net/${videoId}/play_${quality}.mp4`;
}

function parseBunnyVideoIdFromUrl(bunnyVideoUrl) {
  if (!bunnyVideoUrl) return '';
  try {
    const url = new URL(bunnyVideoUrl);
    const [, videoId] = url.pathname.split('/');
    return videoId || '';
  } catch (error) {
    const parts = bunnyVideoUrl.split('/');
    return parts.length > 3 ? parts[3] : '';
  }
}

async function processNft(nft) {
  if (!nft) return { updated: false, uploaded: false };

  const mediaUrl = nft.imageUrl || '';
  if (!mediaUrl) return { updated: false, uploaded: false };

  if (nft.bunnyVideoId) {
    if (!nft.bunnySourceUrl) {
      nft.bunnySourceUrl = mediaUrl;
      return { updated: true, uploaded: false };
    }
    if (nft.bunnySourceUrl === mediaUrl) {
      return { updated: false, uploaded: false };
    }
  }

  const isVideo = isVideoUrl(mediaUrl) || await isVideoByHead(mediaUrl);
  if (!isVideo) return { updated: false, uploaded: false };

  const bunnyTitle = getBunnyTitle(nft, mediaUrl);
  console.log(`Uploading: ${bunnyTitle}`);
  let videoId;
  try {
    videoId = await createBunnyVideo(bunnyTitle);
  } catch (error) {
    console.warn(`Skipping ${mediaUrl} (create failed: ${error.message || error})`);
    return { updated: false, uploaded: false };
  }

  let buffer;
  try {
    const mediaResp = await fetchWithRetry(mediaUrl, {}, 3, 1000);
    if (!mediaResp.ok) {
      console.warn(`Skipping ${mediaUrl} (download failed: ${mediaResp.status} ${mediaResp.statusText})`);
      return { updated: false, uploaded: false };
    }
    buffer = Buffer.from(await mediaResp.arrayBuffer());
  } catch (error) {
    console.warn(`Skipping ${mediaUrl} (fetch failed: ${error.message || error})`);
    return { updated: false, uploaded: false };
  }

  try {
    await uploadVideoToBunny(videoId, buffer);
  } catch (error) {
    console.warn(`Skipping ${mediaUrl} (upload failed: ${error.message || error})`);
    return { updated: false, uploaded: false };
  }
  nft.bunnyVideoId = videoId;
  nft.bunnySourceUrl = mediaUrl;
  if (PULL_ZONE) {
    nft.bunnyVideoUrl = buildBunnyUrl(videoId, '480p');
  }
  return { updated: true, uploaded: true };
}

async function run() {
  const raw = fs.readFileSync(INPUT_PATH, 'utf8');
  const data = safeJsonParse(raw);
  const items = Array.isArray(data) ? data : Object.values(data);

  let backfilledCount = 0;
  for (const nft of items) {
    if (!nft?.bunnyVideoId && nft?.bunnyVideoUrl) {
      const parsedVideoId = parseBunnyVideoIdFromUrl(nft.bunnyVideoUrl);
      if (parsedVideoId) {
        nft.bunnyVideoId = parsedVideoId;
        backfilledCount += 1;
      }
    }
  }

  if (backfilledCount > 0) {
    if (DRY_RUN) {
      console.log(`Dry run: ${backfilledCount} bunnyVideoId values would be backfilled.`);
    } else {
      const output = Array.isArray(data) ? items : data;
      fs.writeFileSync(OUTPUT_PATH, JSON.stringify(output, null, 2));
      console.log(`Backfilled ${backfilledCount} bunnyVideoId values. Saved to ${OUTPUT_PATH}.`);
    }
  }

  let updatedCount = 0;
  for (const nft of items) {
    if (LIMIT && updatedCount >= LIMIT) break;
    const result = await processNft(nft);
    if (result.updated) updatedCount += 1;
  }

  if (updatedCount === 0) {
    console.log('No videos updated.');
    return;
  }

  if (DRY_RUN) {
    console.log(`Dry run: ${updatedCount} videos would be updated.`);
    return;
  }

  const output = Array.isArray(data) ? items : data;
  fs.writeFileSync(OUTPUT_PATH, JSON.stringify(output, null, 2));
  console.log(`Updated ${updatedCount} videos. Saved to ${OUTPUT_PATH}.`);
}

run().catch((error) => {
  console.error(error);
  process.exit(1);
});
