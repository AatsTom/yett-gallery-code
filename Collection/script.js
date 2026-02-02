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

let currentPage  = 1;
let itemsPerPage = calculateItemsPerPage();
let totalNFTs    = [];
let modifiedNFTs = {};

function calculateItemsPerPage() {
  const nftCardWidth = isMobileDevice() ? 100 : 250;
  const cols = Math.floor(window.innerWidth / nftCardWidth);
  const rows = Math.ceil(window.innerHeight / (nftCardWidth + 100)) + 1;
  return cols * rows;
}

function isMobileDevice() {
  return /Mobi|Android/i.test(navigator.userAgent);
}

function optimizeImageUrl(url) {
  if (url.includes('seadn.io')) {
    return url.replace(/\?.*$/, '') + '?w=350&auto=format';
  } else if (url.includes('cloudinary.com')) {
    return url.replace('/upload/', '/upload/w_350/');
  } else if (url.includes('ipfs.io')) {
    return url.replace('ipfs.io', 'dweb.link');
  } else {
    return url;
  }
}

const fetchModifiedNFTs = async () => {
  const fileUrl  = 'https://api.github.com/repos/AatsTom/nft-collection-backend/contents/modifiedNFTData.json';
  const resp     = await fetch(`/wp-json/nft/v1/fetch-data?url=${encodeURIComponent(fileUrl)}`);
  const result   = await resp.json();
  if (result.status === 200) modifiedNFTs = result.data;
};

const fetchOriginalNFTs = async () => {
  const fileUrl  = 'https://api.github.com/repos/AatsTom/nft-collection-backend/contents/nftData.json';
  const resp     = await fetch(`/wp-json/nft/v1/fetch-data?url=${encodeURIComponent(fileUrl)}`);
  const result   = await resp.json();
  if (result.status === 200) totalNFTs = result.data;
};

const mergeNFTData = () => {
  totalNFTs.forEach(nft => {
    if (modifiedNFTs[nft.name]) {
      Object.assign(nft, modifiedNFTs[nft.name]);
    }
  });
};

const displayNFTs = (page) => {
  const container  = document.getElementById('nft-container');
  const startIndex = (page - 1) * itemsPerPage;
  const slice      = totalNFTs.slice(startIndex, page * itemsPerPage);

  slice.forEach(async (nft) => {
    if (nft.hidden) return;
    const card = document.createElement('div');
    card.classList.add('nft-card');

    const name      = nft.name;
    const creator   = nft.creator;
    let mediaUrl    = optimizeImageUrl(nft.imageUrl);

    // 1) optimize placeholder
    let placeholderUrl = optimizeImageUrl(nft.placeholder);
    // 2) append ?frame-time=1 if it's a SeaDN/OpenSea .mp4/.mov
    placeholderUrl = normalizePlaceholderUrl(placeholderUrl);
    // 3) then force width
    placeholderUrl = placeholderUrl.replace('/upload/', '/upload/w_350/');

    const mediaElement = await createMediaElement(mediaUrl, placeholderUrl, name);

    card.innerHTML = `
      <div style="position:relative;">
        ${mediaElement}
        <div class="gradient-overlay">
          <h2>${name}</h2>
          <p>${creator}</p>
        </div>
      </div>
    `;

    // Open modal on card click
    card.addEventListener('click', () => openNftModal(nft));

    container.appendChild(card);
  });
};

/**
 * Card media element:
 * - No click-to-load behavior.
 * - If placeholder is a video, show it muted+autoplay as a preview.
 * - Any click on the card opens the modal.
 */
async function createMediaElement(mediaUrl, placeholderUrl, nftName) {
  try {
    const headResp    = await fetch(mediaUrl, { method: 'HEAD' });
    const contentType = headResp.headers.get('Content-Type') || '';

    if (contentType.startsWith('video')) {
      // normalize to mp4 for playback reliability
      if (mediaUrl.endsWith('.mov')) {
        mediaUrl = mediaUrl.replace('.mov', '.mp4');
      }
      const optimizedMediaUrl = mediaUrl.replace('/upload/', '/upload/w_350/');

      // placeholder itself is a video -> preview silently
      if (/\.(mp4|mov)$/i.test(placeholderUrl)) {
        return `
          <video muted autoplay playsinline
                 style="max-width:100%;aspect-ratio:1/1;object-fit:cover;object-position:center;">
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

  // fallback to plain image
  return `<img src="${placeholderUrl}" alt="${nftName}" loading="lazy" style="max-width:100%;">`;
}

function handleScroll() {
  const { scrollTop, scrollHeight, clientHeight } = document.documentElement;
  if (scrollTop + clientHeight >= scrollHeight / 2) {
    currentPage++;
    displayNFTs(currentPage);
    if (currentPage * itemsPerPage >= totalNFTs.length) {
      window.removeEventListener('scroll', handleScroll);
    }
  }
}

window.addEventListener('resize', () => {
  itemsPerPage = calculateItemsPerPage();
});

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

function optimizeVideoUrl(url, width) {
  if (url.includes('cloudinary.com')) {
    return url.replace('/upload/', `/upload/q_auto:low,f_auto,w_${width}/`);
  }
  return url;
}

/**
 * Modal media element:
 * - Autoplay on desktop; metadata-only load on mobile to avoid heavy downloads.
 * - No play overlay in the modal.
 */
async function createMediaElementForModal(mediaUrl, placeholderUrl, nftName) {
  try {
    const headResp    = await fetch(mediaUrl, { method: 'HEAD' });
    const contentType = headResp.headers.get('Content-Type') || '';

    if (contentType.startsWith('video')) {
      if (mediaUrl.endsWith('.mov')) {
        mediaUrl = mediaUrl.replace('.mov', '.mp4');
      }
      const isMobile = isMobileDevice();
      const targetWidth = isMobile ? 480 : 800;
      const optimizedMediaUrl = optimizeVideoUrl(mediaUrl.replace('/upload/', `/upload/w_${targetWidth}/`), targetWidth);
      const autoMute = isMobile ? 'muted' : '';
      const autoPlay = isMobile ? '' : 'autoplay';
      const preload = isMobile ? 'preload="metadata"' : 'preload="auto"';
      const posterAttr = placeholderUrl ? `poster="${placeholderUrl}"` : '';

      return `
        <video ${autoMute} ${autoPlay} controls playsinline ${preload} ${posterAttr}
               style="width:100%;height:100%;object-fit:contain;object-position:center;aspect-ratio:1/1;">
          <source src="${optimizedMediaUrl}" type="video/mp4">
        </video>
      `;
    }
  } catch (e) {
    console.error('Error fetching media type:', e);
  }

  // fallback to image if not video
  return `<img src="${placeholderUrl}" alt="${nftName}" loading="lazy"
               style="max-width:100%;object-fit:contain;object-position:center;aspect-ratio:1/1;">`;
}

async function openNftModal(nft) {
  const modal     = document.getElementById('nft-modal');
  const titleEl   = document.getElementById('modal-title');
  const artistEl  = document.getElementById('modal-artist');
  const mediaWrap = document.getElementById('modal-artwork-container');

  titleEl.textContent  = nft.name || '';
  artistEl.textContent = nft.creator || '';

  let mediaUrl       = optimizeImageUrl600(nft.imageUrl || '');
  let placeholderUrl = optimizeImageUrl600(nft.placeholder || '');
  placeholderUrl     = normalizePlaceholderUrl(placeholderUrl);
  placeholderUrl     = placeholderUrl.replace('/upload/', '/upload/w_600/');

  mediaWrap.innerHTML = await createMediaElementForModal(mediaUrl, placeholderUrl, nft.name || '');

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

// Close events
document.addEventListener('click', (e) => {
  if (e.target && e.target.hasAttribute && e.target.hasAttribute('data-close-modal')) {
    closeNftModal();
  }
});
document.addEventListener('keydown', (e) => {
  if (e.key === 'Escape') closeNftModal();
});

async function initGallery() {
  const container = document.getElementById('nft-container');
  const modal = document.getElementById('nft-modal');
  if (!container || !modal) {
    console.error('NFT gallery: missing required HTML (#nft-container and #nft-modal).');
    return;
  }

  await fetchOriginalNFTs();
  await fetchModifiedNFTs();
  mergeNFTData();
  totalNFTs.sort(() => 0.5 - Math.random());
  displayNFTs(currentPage);
  window.addEventListener('scroll', handleScroll);
}

if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', initGallery);
} else {
  initGallery();
}
