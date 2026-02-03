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
let filteredNFTs = [];
let modifiedNFTs = {};
let activeFilters = {
  artist: 'all',
  chain: 'all',
  search: '',
  media: 'all'
};

const BUNNY_PULL_ZONE = window.BUNNY_PULL_ZONE || '';

function calculateItemsPerPage() {
  const nftCardWidth = isMobileDevice() ? 100 : 250;
  const cols = Math.floor(window.innerWidth / nftCardWidth);
  const rows = Math.ceil(window.innerHeight / (nftCardWidth + 100)) + 1;
  return cols * rows;
}

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

const displayNFTs = (page, list) => {
  const container  = document.getElementById('nft-container');
  const startIndex = (page - 1) * itemsPerPage;
  const slice      = list.slice(startIndex, page * itemsPerPage);

  slice.forEach(async (nft) => {
    if (nft.hidden) return;
    const card = document.createElement('div');
    card.classList.add('nft-card');

    const name      = nft.name;
    const creator   = nft.creator;
    let mediaUrl    = optimizeImageUrl(nft.imageUrl);
    const bunnyFullUrl = getBunnyPlaybackUrl(nft, isMobileDevice() ? '480p' : '720p');
    if (bunnyFullUrl) {
      mediaUrl = bunnyFullUrl;
    }

    // 1) optimize placeholder
    let placeholderUrl = optimizeImageUrl(nft.placeholder);
    // 2) append ?frame-time=1 if it's a SeaDN/OpenSea .mp4/.mov
    placeholderUrl = normalizePlaceholderUrl(placeholderUrl);
    // 3) then force width
    placeholderUrl = placeholderUrl.replace('/upload/', '/upload/w_350/');

    const mediaElement = await createMediaElement(mediaUrl, placeholderUrl, name, nft);

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
async function createMediaElement(mediaUrl, placeholderUrl, nftName, nft) {
  try {
    const bunnyPreviewUrl = getBunnyPlaybackUrl(nft, '480p');
    const bunnyFullUrl = getBunnyPlaybackUrl(nft, isMobileDevice() ? '480p' : '720p');

    if (bunnyFullUrl) {
      const previewVideoUrl = bunnyPreviewUrl || placeholderUrl;
      if (/\.(mp4|mov)$/i.test(placeholderUrl)) {
        return `
          <video muted autoplay playsinline
                 style="max-width:100%;aspect-ratio:1/1;object-fit:cover;object-position:center;">
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
    displayNFTs(currentPage, filteredNFTs);
    if (currentPage * itemsPerPage >= filteredNFTs.length) {
      window.removeEventListener('scroll', handleScroll);
    }
  }
}

window.addEventListener('resize', () => {
  itemsPerPage = calculateItemsPerPage();
});

function getArtistValue(nft) {
  return (nft.creator || '').trim();
}

function getChainValue(nft) {
  return (nft.chain || nft.blockchain || nft.network || '').trim();
}

function normalizeChainValue(chainValue) {
  return chainValue.trim().toLowerCase();
}

function formatChainLabel(chainValue) {
  return chainValue
    .toLowerCase()
    .split(' ')
    .filter(Boolean)
    .map((word) => word[0].toUpperCase() + word.slice(1))
    .join(' ');
}

function getMediaType(nft) {
  if (nft.bunnyVideoId || nft.bunnyVideoUrl) {
    return 'video';
  }
  const url = (nft.imageUrl || nft.placeholder || '').toLowerCase();
  if (url.endsWith('.gif')) return 'gif';
  if (url.match(/\.(mp4|mov|webm)$/)) return 'video';
  return 'image';
}

function getSearchableText(nft) {
  const title = nft.name || '';
  const artist = getArtistValue(nft);
  const chain = getChainValue(nft);
  return `${title} ${artist} ${chain}`.toLowerCase();
}

function populateFilterOptions() {
  const artistSelect = document.getElementById('artist-filter');
  const chainSelect = document.getElementById('chain-filter');
  if (!artistSelect || !chainSelect) return;

  const artists = new Map();
  const chains = new Map();
  const mediaCounts = new Map();
  let visibleTotal = 0;

  totalNFTs.forEach((nft) => {
    if (nft.hidden) return;
    visibleTotal += 1;
    const artist = getArtistValue(nft);
    const chain = getChainValue(nft);
    const mediaType = getMediaType(nft);
    if (artist) {
      artists.set(artist, (artists.get(artist) || 0) + 1);
    }
    if (chain) {
      const normalized = normalizeChainValue(chain);
      if (!chains.has(normalized)) {
        chains.set(normalized, { label: formatChainLabel(chain), count: 0 });
      }
      chains.get(normalized).count += 1;
    }
    mediaCounts.set(mediaType, (mediaCounts.get(mediaType) || 0) + 1);
  });

  const sortedArtists = Array.from(artists.entries()).sort((a, b) => a[0].localeCompare(b[0]));
  const sortedChains = Array.from(chains.entries()).sort((a, b) => a[1].label.localeCompare(b[1].label));

  artistSelect.innerHTML = `<option value="all">All artists (${visibleTotal})</option>`;
  chainSelect.innerHTML = `<option value="all">All chains (${visibleTotal})</option>`;

  sortedArtists.forEach(([artist, count]) => {
    const option = document.createElement('option');
    option.value = artist;
    option.textContent = `${artist} (${count})`;
    artistSelect.appendChild(option);
  });

  sortedChains.forEach(([normalized, data]) => {
    const option = document.createElement('option');
    option.value = normalized;
    option.textContent = `${data.label} (${data.count})`;
    chainSelect.appendChild(option);
  });

  const mediaSelect = document.getElementById('media-filter');
  if (mediaSelect) {
    mediaSelect.innerHTML = `
      <option value="all">All media (${visibleTotal})</option>
      <option value="image">Images (${mediaCounts.get('image') || 0})</option>
      <option value="video">Videos (${mediaCounts.get('video') || 0})</option>
      <option value="gif">GIFs (${mediaCounts.get('gif') || 0})</option>
    `;
  }

  artistSelect.value = activeFilters.artist;
  chainSelect.value = activeFilters.chain;
  if (mediaSelect) mediaSelect.value = activeFilters.media;
}

function applyFilters() {
  const searchInput = document.getElementById('collection-search');
  const artistSelect = document.getElementById('artist-filter');
  const chainSelect = document.getElementById('chain-filter');
  const mediaSelect = document.getElementById('media-filter');
  if (!searchInput || !artistSelect || !chainSelect || !mediaSelect) return;

  activeFilters = {
    search: searchInput.value.trim().toLowerCase(),
    artist: artistSelect.value,
    chain: chainSelect.value,
    media: mediaSelect.value
  };

  filteredNFTs = totalNFTs.filter((nft) => {
    if (nft.hidden) return false;

    const artist = getArtistValue(nft);
    const chain = normalizeChainValue(getChainValue(nft));
    const mediaType = getMediaType(nft);

    if (activeFilters.artist !== 'all' && artist !== activeFilters.artist) {
      return false;
    }

    if (activeFilters.chain !== 'all' && chain !== activeFilters.chain) {
      return false;
    }

    if (activeFilters.media !== 'all' && mediaType !== activeFilters.media) {
      return false;
    }

    if (activeFilters.search) {
      const searchableText = getSearchableText(nft);
      if (!searchableText.includes(activeFilters.search)) {
        return false;
      }
    }

    return true;
  });

  currentPage = 1;
  const container = document.getElementById('nft-container');
  if (container) container.innerHTML = '';
  displayNFTs(currentPage, filteredNFTs);

  const filterCount = document.getElementById('collection-filters-count');
  if (filterCount) {
    const totalVisible = totalNFTs.filter((nft) => !nft.hidden).length;
    filterCount.textContent = `Showing ${filteredNFTs.length} of ${totalVisible}`;
  }

  window.removeEventListener('scroll', handleScroll);
  if (currentPage * itemsPerPage < filteredNFTs.length) {
    window.addEventListener('scroll', handleScroll);
  }
}

function registerFilterListeners() {
  const searchInput = document.getElementById('collection-search');
  const artistSelect = document.getElementById('artist-filter');
  const chainSelect = document.getElementById('chain-filter');
  const mediaSelect = document.getElementById('media-filter');
  const resetButton = document.querySelector('.collection-reset');
  const fieldResetButtons = document.querySelectorAll('.collection-field-reset');

  if (searchInput) {
    searchInput.addEventListener('input', () => {
      applyFilters();
    });
  }
  if (artistSelect) {
    artistSelect.addEventListener('change', () => {
      applyFilters();
    });
  }
  if (chainSelect) {
    chainSelect.addEventListener('change', () => {
      applyFilters();
    });
  }
  if (mediaSelect) {
    mediaSelect.addEventListener('change', () => {
      applyFilters();
    });
  }
  if (resetButton) {
    resetButton.addEventListener('click', () => {
      if (searchInput) searchInput.value = '';
      if (artistSelect) artistSelect.value = 'all';
      if (chainSelect) chainSelect.value = 'all';
      if (mediaSelect) mediaSelect.value = 'all';
      applyFilters();
    });
  }
  fieldResetButtons.forEach((button) => {
    button.addEventListener('click', () => {
      const targetId = button.getAttribute('data-reset-target');
      if (!targetId) return;
      const target = document.getElementById(targetId);
      if (!target) return;
      if (target.tagName === 'SELECT') {
        target.value = 'all';
      } else {
        target.value = '';
      }
      applyFilters();
    });
  });
  registerFilterPanelListeners();
}

function registerFilterPanelListeners() {
  const toggleButton = document.querySelector('.collection-filter-toggle');
  const panel = document.getElementById('collection-filters-panel');
  const closeButton = document.querySelector('.collection-filters-close');

  if (!toggleButton || !panel) return;

  const openPanel = () => {
    panel.classList.remove('hidden');
    panel.setAttribute('aria-hidden', 'false');
    toggleButton.setAttribute('aria-expanded', 'true');
  };

  const closePanel = () => {
    panel.classList.add('hidden');
    panel.setAttribute('aria-hidden', 'true');
    toggleButton.setAttribute('aria-expanded', 'false');
  };

  toggleButton.addEventListener('click', () => {
    if (panel.classList.contains('hidden')) {
      openPanel();
    } else {
      closePanel();
    }
  });

  if (closeButton) {
    closeButton.addEventListener('click', closePanel);
  }

  document.addEventListener('click', (event) => {
    if (!panel.contains(event.target) && !toggleButton.contains(event.target)) {
      closePanel();
    }
  });
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

/**
 * Modal media element:
 * - Always shows the full video immediately (autoplay).
 * - No play overlay in the modal.
 */
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
      const autoMute = isMobileDevice() ? 'muted' : ''; // mobile often requires muted for autoplay

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

// Close events
document.addEventListener('click', (e) => {
  if (e.target && e.target.hasAttribute && e.target.hasAttribute('data-close-modal')) {
    closeNftModal();
  }
});
document.addEventListener('keydown', (e) => {
  if (e.key === 'Escape') closeNftModal();
});

(async function init() {
  await fetchOriginalNFTs();
  await fetchModifiedNFTs();
  mergeNFTData();
  totalNFTs.sort(() => 0.5 - Math.random());
  filteredNFTs = totalNFTs.filter((nft) => !nft.hidden);
  populateFilterOptions();
  registerFilterListeners();
  applyFilters();
})();
