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

function optimizeImageUrl(url) {
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

function loadFullVideo(element, mediaUrl, extension) {
  const videoContainer = element.previousElementSibling;
  videoContainer.outerHTML = `
    <video controls autoplay playsinline
           style="max-width:100%;aspect-ratio:1/1;object-fit:contain;object-position:center;">
      <source src="${mediaUrl}" type="video/mp4">
    </video>`;
  element.remove();
}

async function createMediaElement(mediaUrl, placeholderUrl, nftName, nft) {
  try {
    const bunnyPreviewUrl = getBunnyPlaybackUrl(nft, '480p');
    const bunnyFullUrl = getBunnyPlaybackUrl(nft, isMobileDevice() ? '480p' : '720p');

    if (bunnyFullUrl) {
      const autoAttr = isMobileDevice() ? 'autoplay' : '';
      const previewVideoUrl = bunnyPreviewUrl || placeholderUrl;
      if (/\.(mp4|mov)$/i.test(placeholderUrl)) {
        return `
          <video muted ${autoAttr} playsinline
                 style="max-width:100%;aspect-ratio:1/1;object-fit:cover;object-position:center;">
            <source src="${previewVideoUrl}" type="video/mp4">
            <img src="${placeholderUrl}" alt="${nftName}">
          </video>
          <div class="click-to-load"
               style="position:absolute;top:0;left:0;width:100%;height:100%;cursor:pointer;"
               onclick="loadFullVideo(this,'${bunnyFullUrl}','mp4')">
            <img src="https://www.yett.gallery/wp-content/uploads/2024/12/play-button-icon-white.png"
                 class="play-button-icon" alt="Play Icon">
          </div>
        `;
      }

      return `
        <div style="position:relative;">
          <img src="${placeholderUrl}" alt="${nftName}"
               style="max-width:100%;cursor:pointer;"
               onclick="this.nextElementSibling.remove(); this.outerHTML = '<video controls autoplay playsinline style=\\'max-width:100%;aspect-ratio:1/1;object-fit:contain;object-position:center;\\'><source src=\\'${bunnyFullUrl}\\' type=\\'video/mp4\\'></video>'">
          <img src="https://www.yett.gallery/wp-content/uploads/2024/12/play-button-icon-white.png"
               class="play-button-icon" alt="Play Icon">
        </div>
      `;
    }

    const headResp    = await fetch(mediaUrl, { method: 'HEAD' });
    const contentType = headResp.headers.get('Content-Type') || '';

    if (contentType.includes('video')) {
      // always use mp4
      if (mediaUrl.endsWith('.mov')) {
        mediaUrl = mediaUrl.replace('.mov', '.mp4');
      }
      const optimizedMediaUrl = mediaUrl.replace('/upload/', '/upload/w_600/');
      const autoAttr = isMobileDevice() ? 'autoplay' : '';

      if (/\.(mp4|mov)$/i.test(placeholderUrl)) {
        return `
          <video muted ${autoAttr} playsinline
                 style="max-width:100%;aspect-ratio:1/1;object-fit:cover;object-position:center;">
            <source src="${placeholderUrl}" type="video/mp4">
            <img src="${mediaUrl}" alt="${nftName}">
          </video>
          <div class="click-to-load"
               style="position:absolute;top:0;left:0;width:100%;height:100%;cursor:pointer;"
               onclick="loadFullVideo(this,'${optimizedMediaUrl}','mp4')">
            <img src="https://www.yett.gallery/wp-content/uploads/2024/12/play-button-icon-white.png"
                 class="play-button-icon" alt="Play Icon">
          </div>
        `;
      }

      return `
        <div style="position:relative;">
          <img src="${placeholderUrl}" alt="${nftName}"
               style="max-width:100%;cursor:pointer;"
               onclick="this.nextElementSibling.remove(); this.outerHTML = '<video controls autoplay playsinline style=\\'max-width:100%;aspect-ratio:1/1;object-fit:contain;object-position:center;\\'><source src=\\'${optimizedMediaUrl}\\' type=\\'video/mp4\\'></video>'">
          <img src="https://www.yett.gallery/wp-content/uploads/2024/12/play-button-icon-white.png"
               class="play-button-icon" alt="Play Icon">
        </div>
      `;
    }
  } catch (e) {
    console.error('Error fetching media type:', e);
  }

  // fallback to image
  return `<img src="${placeholderUrl}" alt="${nftName}" loading="lazy"
               style="max-width:100%;object-fit:cover;object-position:center;aspect-ratio:1/1;">`;
}

// Display featured artwork (prefer pinned, else random)
async function displayFeaturedArtwork() {
  const visibleNFTs = totalNFTs.filter(n => !n.hidden);
  if (!visibleNFTs.length) return;

  // prefer the pinned/featured NFT if one exists
  const featuredNFT = visibleNFTs.find(n => n.featured === true);
  const nft = featuredNFT || visibleNFTs[Math.floor(Math.random() * visibleNFTs.length)];

  const featuredContainer = document.getElementById('featured-artwork-container');
  document.getElementById('featured-title').textContent  = nft.name;
  document.getElementById('featured-artist').textContent = nft.creator;

  let mediaUrl       = optimizeImageUrl(nft.imageUrl);
  let placeholderUrl = optimizeImageUrl(nft.placeholder);

  placeholderUrl = normalizePlaceholderUrl(placeholderUrl);
  placeholderUrl = placeholderUrl.replace('/upload/', '/upload/w_600/');

  featuredContainer.innerHTML = await createMediaElement(mediaUrl, placeholderUrl, nft.name, nft);
}

// Display 8 random artworks in gallery
async function displayRandomGallery() {
  const galleryContainer = document.getElementById('random-gallery-container');
  const visibleNFTs      = totalNFTs.filter(n => !n.hidden);
  const shuffled         = visibleNFTs.sort(() => 0.5 - Math.random()).slice(0, 8);

  for (const nft of shuffled) {
    const nftCard    = document.createElement('div');
    nftCard.classList.add('nft-card');

    let mediaUrl       = optimizeImageUrl(nft.imageUrl);
    let placeholderUrl = optimizeImageUrl(nft.placeholder);

    placeholderUrl = normalizePlaceholderUrl(placeholderUrl);
    placeholderUrl = placeholderUrl.replace('/upload/', '/upload/w_600/');

    const mediaElement = await createMediaElement(mediaUrl, placeholderUrl, nft.name, nft);

    nftCard.innerHTML = `
      <div style="position:relative;">
        ${mediaElement}
        <div class="gradient-overlay">
          <h2>${nft.name}</h2>
          <p>${nft.creator}</p>
        </div>
      </div>
    `;
    galleryContainer.appendChild(nftCard);
  }
}

// Init
(async function init() {
  await fetchOriginalNFTs();
  await fetchModifiedNFTs();
  mergeNFTData();
  await displayFeaturedArtwork();
  await displayRandomGallery();
})();
