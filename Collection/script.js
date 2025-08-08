/**
 * ===== Helper functions =====
 */
function normalizePlaceholderUrl(url) {
  const clean = url.replace(/\?.*$/, '');
  const isSeaVideo = /\.(mp4|mov)$/i.test(clean) &&
    (clean.includes('seadn.io') || clean.includes('storage.opensea.io'));
  if (isSeaVideo && !url.includes('frame-time=')) {
    return `${clean}?frame-time=1`;
  }
  return url;
}

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
  }
  return url;
}

function optimizeImageUrl600(url) {
  if (url.includes('seadn.io')) {
    return url.replace(/\?.*$/, '') + '?w=600&auto=format';
  } else if (url.includes('cloudinary.com')) {
    return url.replace('/upload/', '/upload/w_600/');
  } else if (url.includes('ipfs.io')) {
    return url.replace('ipfs.io', 'dweb.link');
  }
  return url;
}

/**
 * ===== Data Fetching =====
 */
let currentPage = 1;
let itemsPerPage = calculateItemsPerPage();
let totalNFTs = [];
let modifiedNFTs = {};
let filteredNFTs = [];
let isFiltered = false;

const fetchModifiedNFTs = async () => {
  const fileUrl = 'https://api.github.com/repos/AatsTom/nft-collection-backend/contents/modifiedNFTData.json';
  const resp = await fetch(`/wp-json/nft/v1/fetch-data?url=${encodeURIComponent(fileUrl)}`);
  const result = await resp.json();
  if (result.status === 200) modifiedNFTs = result.data;
};

const fetchOriginalNFTs = async () => {
  const fileUrl = 'https://api.github.com/repos/AatsTom/nft-collection-backend/contents/nftData.json';
  const resp = await fetch(`/wp-json/nft/v1/fetch-data?url=${encodeURIComponent(fileUrl)}`);
  const result = await resp.json();
  if (result.status === 200) totalNFTs = result.data;
};

const mergeNFTData = () => {
  totalNFTs.forEach(nft => {
    if (modifiedNFTs[nft.name]) {
      Object.assign(nft, modifiedNFTs[nft.name]);
    }
  });
};

/**
 * ===== Rendering =====
 */
async function createMediaElement(mediaUrl, placeholderUrl, nftName) {
  try {
    const headResp = await fetch(mediaUrl, { method: 'HEAD' });
    const contentType = headResp.headers.get('Content-Type') || '';

    if (contentType.startsWith('video')) {
      if (mediaUrl.endsWith('.mov')) mediaUrl = mediaUrl.replace('.mov', '.mp4');
      const optimizedMediaUrl = mediaUrl.replace('/upload/', '/upload/w_350/');

      if (/\.(mp4|mov)$/i.test(placeholderUrl)) {
        return `
          <video muted autoplay playsinline style="max-width:100%;aspect-ratio:1/1;object-fit:cover;">
            <source src="${placeholderUrl}" type="video/mp4">
            <img src="${optimizedMediaUrl}" alt="${nftName}">
          </video>
          <img src="https://www.yett.gallery/wp-content/uploads/2024/12/play-button-icon-white.png"
               class="play-button-icon" alt="Play">
        `;
      }

      return `
        <div style="position:relative;">
          <img src="${placeholderUrl}" alt="${nftName}" style="max-width:100%;">
          <img src="https://www.yett.gallery/wp-content/uploads/2024/12/play-button-icon-white.png"
               class="play-button-icon" alt="Play">
        </div>
      `;
    }
  } catch (e) {
    console.error(e);
  }
  return `<img src="${placeholderUrl}" alt="${nftName}" loading="lazy" style="max-width:100%;">`;
}

async function createMediaElementForModal(mediaUrl, placeholderUrl, nftName) {
  try {
    const headResp = await fetch(mediaUrl, { method: 'HEAD' });
    const contentType = headResp.headers.get('Content-Type') || '';

    if (contentType.startsWith('video')) {
      if (mediaUrl.endsWith('.mov')) mediaUrl = mediaUrl.replace('.mov', '.mp4');
      const optimizedMediaUrl = mediaUrl.replace('/upload/', '/upload/w_600/');
      const autoMute = isMobileDevice() ? 'muted' : '';
      return `
        <video ${autoMute} autoplay controls playsinline
               style="width:100%;height:100%;object-fit:contain;aspect-ratio:1/1;">
          <source src="${optimizedMediaUrl}" type="video/mp4">
        </video>
      `;
    }
  } catch (e) {
    console.error('Error fetching media type:', e);
  }
  return `<img src="${placeholderUrl}" alt="${nftName}" loading="lazy"
               style="max-width:100%;object-fit:contain;aspect-ratio:1/1;">`;
}

function renderNFTs(list, page) {
  const container = document.getElementById('nft-container');
  const startIndex = (page - 1) * itemsPerPage;
  const slice = list.slice(startIndex, page * itemsPerPage);

  slice.forEach(async nft => {
    if (nft.hidden) return;
    const card = document.createElement('div');
    card.classList.add('nft-card');

    const name = nft.name;
    const creator = nft.creator;
    let placeholderUrl = optimizeImageUrl(nft.placeholder);
    placeholderUrl = normalizePlaceholderUrl(placeholderUrl).replace('/upload/', '/upload/w_350/');
    const mediaElement = await createMediaElement(optimizeImageUrl(nft.imageUrl), placeholderUrl, name);

    card.innerHTML = `
      <div style="position:relative;">
        ${mediaElement}
        <div class="gradient-overlay">
          <h2>${name}</h2>
          <p>${creator}</p>
        </div>
      </div>
    `;
    card.addEventListener('click', () => openNftModal(nft));
    container.appendChild(card);
  });
}

/**
 * ===== Modal =====
 */
async function openNftModal(nft) {
  const modal = document.getElementById('nft-modal');
  document.getElementById('modal-title').textContent = nft.name || '';
  document.getElementById('modal-artist').textContent = nft.creator || '';
  const mediaWrap = document.getElementById('modal-artwork-container');

  let placeholderUrl = optimizeImageUrl600(nft.placeholder || '');
  placeholderUrl = normalizePlaceholderUrl(placeholderUrl).replace('/upload/', '/upload/w_600/');
  mediaWrap.innerHTML = await createMediaElementForModal(optimizeImageUrl600(nft.imageUrl || ''), placeholderUrl, nft.name || '');

  modal.classList.remove('hidden');
  modal.setAttribute('aria-hidden', 'false');
  document.body.classList.add('nft-modal-open');
}

function closeNftModal() {
  const modal = document.getElementById('nft-modal');
  modal.classList.add('hidden');
  modal.setAttribute('aria-hidden', 'true');
  document.body.classList.remove('nft-modal-open');
  document.getElementById('modal-artwork-container').innerHTML = '';
}

document.addEventListener('click', e => {
  if (e.target && e.target.hasAttribute && e.target.hasAttribute('data-close-modal')) {
    closeNftModal();
  }
});
document.addEventListener('keydown', e => {
  if (e.key === 'Escape') closeNftModal();
});

/**
 * ===== Filters =====
 */
document.getElementById('apply-filters').addEventListener('click', () => {
  const artistVal = document.getElementById('filter-artist').value.toLowerCase();
  const titleVal = document.getElementById('filter-title').value.toLowerCase();
  const chainVal = document.getElementById('filter-chain').value;

  filteredNFTs = totalNFTs.filter(nft => {
    const matchArtist = !artistVal || (nft.creator && nft.creator.toLowerCase().includes(artistVal));
    const matchTitle = !titleVal || (nft.name && nft.name.toLowerCase().includes(titleVal));
    const matchChain = !chainVal || (nft.chain && nft.chain === chainVal);
    return matchArtist && matchTitle && matchChain;
  });

  isFiltered = true;
  currentPage = 1;
  document.getElementById('nft-container').innerHTML = '';
  renderNFTs(filteredNFTs, currentPage);
  closeFilterDrawer();
});

document.getElementById('clear-filters').addEventListener('click', () => {
  document.getElementById('filter-artist').value = '';
  document.getElementById('filter-title').value = '';
  document.getElementById('filter-chain').value = '';
  isFiltered = false;
  currentPage = 1;
  document.getElementById('nft-container').innerHTML = '';
  renderNFTs(totalNFTs, currentPage);
  closeFilterDrawer();
});

/**
 * ===== Filter Drawer =====
 */
const filterBtn = document.getElementById('filter-toggle-btn');
const filterDrawer = document.getElementById('filter-drawer');
const filterCloseBtn = document.getElementById('filter-close-btn');

filterBtn.addEventListener('click', () => {
  filterDrawer.classList.remove('hidden');
  setTimeout(() => filterDrawer.classList.add('open'), 10);
});
filterCloseBtn.addEventListener('click', closeFilterDrawer);

function closeFilterDrawer() {
  filterDrawer.classList.remove('open');
  setTimeout(() => filterDrawer.classList.add('hidden'), 300);
}

/**
 * ===== Infinite Scroll =====
 */
function handleScroll() {
  const { scrollTop, scrollHeight, clientHeight } = document.documentElement;
  if (scrollTop + clientHeight >= scrollHeight / 2) {
    currentPage++;
    if (isFiltered) {
      renderNFTs(filteredNFTs, currentPage);
    } else {
      renderNFTs(totalNFTs, currentPage);
    }
  }
}

/**
 * ===== Init =====
 */
(async function init() {
  await fetchOriginalNFTs();
  await fetchModifiedNFTs();
  mergeNFTData();
  totalNFTs.sort(() => 0.5 - Math.random());
  renderNFTs(totalNFTs, currentPage);
  window.addEventListener('scroll', handleScroll);
})();

window.addEventListener('resize', () => {
  itemsPerPage = calculateItemsPerPage();
});
