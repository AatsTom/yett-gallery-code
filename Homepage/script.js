/**
 * If the URL is an OpenSea/SeaDN video (ends in .mp4/.mov on those domains)
 * and doesn’t already have a frame-time param, strip any query and append frame-time=1.
 */
function normalizePlaceholderUrl(url) {
  const clean = url.replace(/\?.*$/, '');
  const isSeaVideo = /\.(mp4|mov)$/i.test(clean) &&
                     (clean.includes('seadn.io') ||
                      clean.includes('storage.opensea.io'));
  if (isSeaVideo && !url.includes('frame-time=')) {
    return `${clean}?frame-time=1`;
  }
  return url;
}

let totalNFTs    = [];
let modifiedNFTs = {};
let featuredNFT  = null;

const BUNNY_PULL_ZONE = window.BUNNY_PULL_ZONE || '';

function isMobileDevice() {
  return /Mobi|Android/i.test(navigator.userAgent);
}

function getBunnyPlaybackUrl(nft, quality) {
  if (!nft) return '';
  if (nft.bunnyVideoUrl) return nft.bunnyVideoUrl;
  if (!nft.bunnyVideoId) return '';

  const zone = nft.bunnyPullZone || BUNNY_PULL_ZONE;
  if (!zone) return '';

  const qualitySuffix = quality ? `play_${quality}.mp4` : 'play.mp4';
  return `https://${zone}.b-cdn.net/${nft.bunnyVideoId}/${qualitySuffix}`;
}

function optimizeImageUrl(url, width = 600) {
  if (url.includes('seadn.io')) {
    return url.replace(/\?.*$/, '') + `?w=${width}&auto=format`;
  } else if (url.includes('cloudinary.com')) {
    return url.replace('/upload/', `/upload/w_${width}/`);
  } else if (url.includes('ipfs.io')) {
    return url.replace('ipfs.io', 'dweb.link');
  } else {
    return url;
  }
}

function getChainValue(nft) {
  return (nft.chain || nft.blockchain || nft.network || '').trim();
}

function normalizeChainValue(chainValue) {
  return chainValue.trim().toLowerCase();
}

const chainStatsConfig = [
  { key: 'ethereum', label: 'Ethereum' },
  { key: 'matic', label: 'Matic' },
  { key: 'base', label: 'Base' },
  { key: 'zora', label: 'Zora' },
  { key: 'optimism', label: 'Optimism' },
  { key: 'ordinals', label: 'Ordinals' },
  { key: 'solana', label: 'Solana' },
  { key: 'tezos', label: 'Tezos' }
];

function getChainKey(nft) {
  const chain = normalizeChainValue(getChainValue(nft));
  if (chain === 'polygon') return 'matic';
  if (chain === 'bitcoin') return 'ordinals';
  return chain;
}

function formatNumber(value) {
  return Number(value || 0).toLocaleString();
}

function getChainIconData(nft) {
  const chain = normalizeChainValue(getChainValue(nft));
  const chainMap = {
    base: {
      label: 'Base',
      url: 'https://www.yett.gallery/wp-content/uploads/2026/02/Base_V2.png'
    },
    ordinals: {
      label: 'Ordinals',
      url: 'https://www.yett.gallery/wp-content/uploads/2026/02/Bitcoin.png'
    },
    bitcoin: {
      label: 'Ordinals',
      url: 'https://www.yett.gallery/wp-content/uploads/2026/02/Bitcoin.png'
    },
    ethereum: {
      label: 'Ethereum',
      url: 'https://www.yett.gallery/wp-content/uploads/2026/02/Ethereum.png'
    },
    matic: {
      label: 'Matic',
      url: 'https://www.yett.gallery/wp-content/uploads/2026/02/Matic.png'
    },
    polygon: {
      label: 'Matic',
      url: 'https://www.yett.gallery/wp-content/uploads/2026/02/Matic.png'
    },
    optimism: {
      label: 'Optimism',
      url: 'https://www.yett.gallery/wp-content/uploads/2026/02/Optimism.png'
    },
    solana: {
      label: 'Solana',
      url: 'https://www.yett.gallery/wp-content/uploads/2026/02/Solana.png'
    },
    tezos: {
      label: 'Tezos',
      url: 'https://www.yett.gallery/wp-content/uploads/2026/02/Tezos.png'
    },
    zora: {
      label: 'Zora',
      url: 'https://www.yett.gallery/wp-content/uploads/2026/02/Zora.png'
    }
  };

  return chainMap[chain] || null;
}

function updateStats() {
  const statsSection = document.getElementById('stats-section');
  if (!statsSection) return;

  const visibleNFTs = totalNFTs.filter(nft => !nft.hidden);
  const uniqueArtists = new Set(
    visibleNFTs
      .map(nft => (nft.creator || '').trim())
      .filter(Boolean)
  );

  const chainCounts = chainStatsConfig.reduce((acc, chain) => {
    acc[chain.key] = 0;
    return acc;
  }, {});

  visibleNFTs.forEach((nft) => {
    const chainKey = getChainKey(nft);
    if (chainCounts[chainKey] !== undefined) {
      chainCounts[chainKey] += 1;
    }
  });

  const artistsEl = statsSection.querySelector('[data-stat="artists"]');
  const nftsEl = statsSection.querySelector('[data-stat="nfts"]');
  const chainsEl = statsSection.querySelector('[data-stat="chains"]');

  if (artistsEl) artistsEl.textContent = formatNumber(uniqueArtists.size);
  if (nftsEl) nftsEl.textContent = formatNumber(visibleNFTs.length);
  if (chainsEl) chainsEl.textContent = formatNumber(chainStatsConfig.length);

  const chainRows = [
    statsSection.querySelector('[data-chain-row="1"]'),
    statsSection.querySelector('[data-chain-row="2"]')
  ];
  chainRows.forEach((row) => {
    if (row) row.innerHTML = '';
  });

  chainStatsConfig.forEach((chain, index) => {
    const rowIndex = index < 4 ? 0 : 1;
    const row = chainRows[rowIndex];
    if (!row) return;

    const statCard = document.createElement('div');
    statCard.classList.add('stat-card');
    statCard.innerHTML = `
      <div class="stat-value">${formatNumber(chainCounts[chain.key])}</div>
      <div class="stat-label">Collected on ${chain.label}</div>
    `;
    row.appendChild(statCard);
  });
}

async function fetchModifiedNFTs() {
  const fileUrl  = 'https://api.github.com/repos/AatsTom/nft-collection-backend/contents/modifiedNFTData.json';
  const resp     = await fetch(`/wp-json/nft/v1/fetch-data?url=${encodeURIComponent(fileUrl)}`);
  const result   = await resp.json();
  if (result.status === 200) modifiedNFTs = result.data;
  else console.error('Failed to fetch modified NFTs:', result);
}

async function fetchOriginalNFTs() {
  const fileUrl  = 'https://api.github.com/repos/AatsTom/nft-collection-backend/contents/nftData.json';
  const resp     = await fetch(`/wp-json/nft/v1/fetch-data?url=${encodeURIComponent(fileUrl)}`);
  const result   = await resp.json();
  if (result.status === 200) totalNFTs = result.data;
  else console.error('Failed to fetch original NFTs:', result);
}

function mergeNFTData() {
  totalNFTs.forEach(nft => {
    if (modifiedNFTs[nft.name]) {
      Object.assign(nft, modifiedNFTs[nft.name]); // includes .featured if present
    }
  });
}

async function createMediaElement(mediaUrl, placeholderUrl, nftName, nft, targetWidth = 600, fitMode = 'cover') {
  try {
    const bunnyPreviewUrl = getBunnyPlaybackUrl(nft, '480p');
    const bunnyFullUrl = getBunnyPlaybackUrl(nft, isMobileDevice() ? '480p' : '720p');

    if (bunnyFullUrl) {
      const previewVideoUrl = bunnyPreviewUrl || placeholderUrl;
      if (/\.(mp4|mov)$/i.test(placeholderUrl)) {
        return `
          <video muted autoplay playsinline
                 style="max-width:100%;aspect-ratio:1/1;object-fit:${fitMode};object-position:center;">
            <source src="${previewVideoUrl}" type="video/mp4">
            <img src="${placeholderUrl}" alt="${nftName}">
          </video>
          <img src="https://www.yett.gallery/wp-content/uploads/2024/12/play-button-icon-white.png"
               class="play-button-icon" alt="Play">
        `;
      }

      return `
        <div style="position:relative;">
          <img src="${placeholderUrl}" alt="${nftName}"
               style="max-width:100%;">
          <img src="https://www.yett.gallery/wp-content/uploads/2024/12/play-button-icon-white.png"
               class="play-button-icon" alt="Play">
        </div>
      `;
    }

    const headResp    = await fetch(mediaUrl, { method: 'HEAD' });
    const contentType = headResp.headers.get('Content-Type') || '';

    if (contentType.startsWith('video')) {
      // normalize to mp4 for playback reliability
      if (mediaUrl.endsWith('.mov')) {
        mediaUrl = mediaUrl.replace('.mov', '.mp4');
      }
      const optimizedMediaUrl = mediaUrl.replace('/upload/', `/upload/w_${targetWidth}/`);

      // placeholder itself is a video -> preview silently
      if (/\.(mp4|mov)$/i.test(placeholderUrl)) {
        return `
          <video muted autoplay playsinline
                 style="max-width:100%;aspect-ratio:1/1;object-fit:${fitMode};object-position:center;">
            <source src="${placeholderUrl}" type="video/mp4">
            <img src="${optimizedMediaUrl}" alt="${nftName}">
          </video>
          <img src="https://www.yett.gallery/wp-content/uploads/2024/12/play-button-icon-white.png"
               class="play-button-icon" alt="Play">
        `;
      }

      // placeholder is an image (static preview only)
      return `
        <div style="position:relative;">
          <img src="${placeholderUrl}" alt="${nftName}"
               style="max-width:100%;">
          <img src="https://www.yett.gallery/wp-content/uploads/2024/12/play-button-icon-white.png"
               class="play-button-icon" alt="Play">
        </div>
      `;
    }
  } catch (e) {
    console.error(e);
  }

  // fallback to image
  return `<img src="${placeholderUrl}" alt="${nftName}" loading="lazy" style="max-width:100%;">`;
}

// Display featured artwork (prefer pinned, else random)
async function displayFeaturedArtwork() {
  const visibleNFTs = totalNFTs.filter(n => !n.hidden);
  if (!visibleNFTs.length) return;

  // prefer the pinned/featured NFT if one exists
  const preferredNFT = visibleNFTs.find(n => n.featured === true);
  const nft = preferredNFT || visibleNFTs[Math.floor(Math.random() * visibleNFTs.length)];
  featuredNFT = nft;

  const featuredContainer = document.getElementById('featured-artwork-container');
  document.getElementById('featured-title').textContent  = nft.name;
  document.getElementById('featured-artist').textContent = nft.creator;

  let mediaUrl       = optimizeImageUrl(nft.imageUrl, 600);
  const bunnyFullUrl = getBunnyPlaybackUrl(nft, isMobileDevice() ? '480p' : '720p');
  if (bunnyFullUrl) {
    mediaUrl = bunnyFullUrl;
  }
  let placeholderUrl = optimizeImageUrl(nft.placeholder, 600);

  placeholderUrl = normalizePlaceholderUrl(placeholderUrl);
  placeholderUrl = placeholderUrl.replace('/upload/', '/upload/w_600/');

  const chainIcon = getChainIconData(nft);
  const chainIconMarkup = chainIcon
    ? `<img src="${chainIcon.url}" class="chain-icon" alt="${chainIcon.label} chain">`
    : '';
  const mediaElement = await createMediaElement(mediaUrl, placeholderUrl, nft.name, nft, 600, 'contain');

  featuredContainer.innerHTML = `
    <div class="featured-media-frame" style="position:relative;">
      ${mediaElement}
      ${chainIconMarkup}
    </div>
  `;
  featuredContainer.onclick = () => openNftModal(nft);
}

// Display 8 random artworks in gallery
async function displayRandomGallery() {
  const galleryContainer = document.getElementById('random-gallery-container');
  const visibleNFTs      = totalNFTs.filter(n => !n.hidden);
  const shuffled         = visibleNFTs.sort(() => 0.5 - Math.random()).slice(0, 8);

  const cards = await Promise.all(shuffled.map(async (nft) => {
    const nftCard    = document.createElement('div');
    nftCard.classList.add('nft-card');

    let mediaUrl       = optimizeImageUrl(nft.imageUrl, 350);
    const bunnyFullUrl = getBunnyPlaybackUrl(nft, isMobileDevice() ? '480p' : '720p');
    if (bunnyFullUrl) {
      mediaUrl = bunnyFullUrl;
    }
    let placeholderUrl = optimizeImageUrl(nft.placeholder, 350);

    placeholderUrl = normalizePlaceholderUrl(placeholderUrl);
    placeholderUrl = placeholderUrl.replace('/upload/', '/upload/w_350/');

    const mediaElement = await createMediaElement(mediaUrl, placeholderUrl, nft.name, nft, 350);

    const chainIcon = getChainIconData(nft);
    const chainIconMarkup = chainIcon
      ? `<img src="${chainIcon.url}" class="chain-icon" alt="${chainIcon.label} chain">`
      : '';

    nftCard.innerHTML = `
      <div style="position:relative;">
        ${mediaElement}
        ${chainIconMarkup}
        <div class="gradient-overlay">
          <h2>${nft.name}</h2>
          <p>${nft.creator}</p>
        </div>
      </div>
    `;
    nftCard.addEventListener('click', () => openNftModal(nft));
    return nftCard;
  }));

  const fragment = document.createDocumentFragment();
  cards.forEach((card) => fragment.appendChild(card));
  galleryContainer.appendChild(fragment);
}

/* ===== Modal logic (featured-style) ===== */

function optimizeImageUrl600(url) {
  if (url.includes('seadn.io')) {
    return url.replace(/\?.*$/, '') + '?w=600&auto=format';
  } else if (url.includes('cloudinary.com')) {
    return url.replace('/upload/', '/upload/w_600/');
  } else if (url.includes('ipfs.io')) {
    return url.replace('ipfs.io', 'dweb.link');
  } else {
    return url;
  }
}

async function createMediaElementForModal(mediaUrl, placeholderUrl, nftName, nft) {
  try {
    const bunnyFullUrl = getBunnyPlaybackUrl(nft, isMobileDevice() ? '480p' : '720p');

    if (bunnyFullUrl) {
      const autoMute = isMobileDevice() ? 'muted' : '';
      return `
        <video ${autoMute} autoplay controls playsinline poster="${placeholderUrl}"
               style="width:100%;height:100%;object-fit:contain;object-position:center;aspect-ratio:1/1;">
          <source src="${bunnyFullUrl}" type="video/mp4">
        </video>
      `;
    }

    const headResp    = await fetch(mediaUrl, { method: 'HEAD' });
    const contentType = headResp.headers.get('Content-Type') || '';

    if (contentType.startsWith('video')) {
      if (mediaUrl.endsWith('.mov')) {
        mediaUrl = mediaUrl.replace('.mov', '.mp4');
      }
      const optimizedMediaUrl = mediaUrl.replace('/upload/', '/upload/w_600/');
      const autoMute = isMobileDevice() ? 'muted' : '';

      return `
        <video ${autoMute} autoplay controls playsinline poster="${placeholderUrl}"
               style="width:100%;height:100%;object-fit:contain;object-position:center;aspect-ratio:1/1;">
          <source src="${optimizedMediaUrl}" type="video/mp4">
        </video>
      `;
    }
  } catch (e) {
    console.error('Error fetching media type:', e);
  }

  return `<img src="${placeholderUrl}" alt="${nftName}" loading="lazy"
               style="max-width:100%;object-fit:contain;object-position:center;aspect-ratio:1/1;">`;
}

async function openNftModal(nft) {
  const modal     = document.getElementById('nft-modal');
  const titleEl   = document.getElementById('modal-title');
  const artistEl  = document.getElementById('modal-artist');
  const mediaWrap = document.getElementById('modal-artwork-container');
  const marketplaceLink = document.getElementById('modal-marketplace-link');

  titleEl.textContent  = nft.name || '';
  artistEl.textContent = nft.creator || '';
  if (marketplaceLink) {
    const marketplaceUrl = (nft.marketplace_url || nft.marketplaceUrl || '').trim();
    if (marketplaceUrl) {
      marketplaceLink.href = marketplaceUrl;
      marketplaceLink.hidden = false;
    } else {
      marketplaceLink.removeAttribute('href');
      marketplaceLink.hidden = true;
    }
  }

  let mediaUrl       = optimizeImageUrl600(nft.imageUrl || '');
  const bunnyFullUrl = getBunnyPlaybackUrl(nft, isMobileDevice() ? '480p' : '720p');
  if (bunnyFullUrl) {
    mediaUrl = bunnyFullUrl;
  }
  let placeholderUrl = optimizeImageUrl600(nft.placeholder || '');
  placeholderUrl     = normalizePlaceholderUrl(placeholderUrl);
  placeholderUrl     = placeholderUrl.replace('/upload/', '/upload/w_600/');

  mediaWrap.innerHTML = await createMediaElementForModal(mediaUrl, placeholderUrl, nft.name || '', nft);

  modal.classList.remove('hidden');
  modal.setAttribute('aria-hidden', 'false');
  document.body.classList.add('nft-modal-open');
}

function closeNftModal() {
  const modal = document.getElementById('nft-modal');
  if (!modal) return;
  modal.classList.add('hidden');
  modal.setAttribute('aria-hidden', 'true');
  document.body.classList.remove('nft-modal-open');

  const mediaWrap = document.getElementById('modal-artwork-container');
  if (mediaWrap) mediaWrap.innerHTML = '';
}

document.addEventListener('click', (e) => {
  if (e.target && e.target.hasAttribute && e.target.hasAttribute('data-close-modal')) {
    closeNftModal();
  }
});
document.addEventListener('keydown', (e) => {
  if (e.key === 'Escape') closeNftModal();
});

// Init
(async function init() {
  await Promise.all([fetchOriginalNFTs(), fetchModifiedNFTs()]);
  mergeNFTData();
  updateStats();
  await Promise.all([displayFeaturedArtwork(), displayRandomGallery()]);
})();
