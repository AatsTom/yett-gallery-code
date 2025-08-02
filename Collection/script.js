<script>
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
      container.appendChild(card);
    });
  };

  async function createMediaElement(mediaUrl, placeholderUrl, nftName) {
    try {
      const headResp    = await fetch(mediaUrl, { method: 'HEAD' });
      const contentType = headResp.headers.get('Content-Type') || '';

      if (contentType.startsWith('video')) {
        const ext = 'mp4';
        if (mediaUrl.endsWith('.mov')) {
          // still swap .mov to .mp4 so it plays correctly
          mediaUrl = mediaUrl.replace('.mov', '.mp4');
        }

        const optimizedMediaUrl = mediaUrl.replace('/upload/', '/upload/w_350/');
        const autoAttr = isMobileDevice() ? 'autoplay' : '';

        // if placeholder itself is a video
        if (/\.(mp4|mov)$/i.test(placeholderUrl)) {
          return `
            <video muted ${autoAttr} playsinline
                   style="max-width:100%;aspect-ratio:1/1;object-fit:cover;object-position:center;">
              <source src="${placeholderUrl}" type="video/mp4">
              <img src="${mediaUrl}" alt="${nftName}">
            </video>
            <div class="click-to-load" style="position:absolute;top:0;left:0;width:100%;height:100%;cursor:pointer;"
                 onclick="loadFullVideo(this,'${optimizedMediaUrl}','${ext}')">
              <img src="https://www.yett.gallery/wp-content/uploads/2024/12/play-button-icon-white.png"
                   class="play-button-icon" alt="Play">
            </div>
          `;
        }

        // placeholder is an image → swap to video on click
        return `
          <div style="position:relative;">
            <img src="${placeholderUrl}" alt="${nftName}"
                 style="max-width:100%;cursor:pointer;"
                 onclick="this.nextElementSibling.remove(); this.outerHTML = '<video controls autoplay playsinline style=\\'max-width:100%;aspect-ratio:1/1;object-fit:contain;object-position:center;\\'><source src=\\'${optimizedMediaUrl}\\' type=\\'video/${ext}\\'></video>'">
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

  function loadFullVideo(el, url, ext) {
    const vid = el.previousElementSibling;
    vid.outerHTML = `<video controls autoplay style="max-width:100%;"><source src="${url}" type="video/${ext}"></video>`;
    el.remove();
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

  (async function init() {
    await fetchOriginalNFTs();
    await fetchModifiedNFTs();
    mergeNFTData();
    totalNFTs.sort(() => 0.5 - Math.random());
    displayNFTs(currentPage);
    window.addEventListener('scroll', handleScroll);
  })();
</script>
