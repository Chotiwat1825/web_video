/* ===================================================
   PlayIDTV � App Logic (Enhanced Edition)
   =================================================== */

// ── State ──────────────────────────────────────────
let state = {
  playlists:      [],     // loaded from playlists_index.json
  playlistIdx:    0,      // selected playlist index
  data:           null,   // parsed active playlist
  allVideos:      [],     // flat list of all video stations
  filteredVideos: [],     // after filter / search
  activeGroup:    'all',
  currentVideo:   null,
  currentIndex:   0,
  page:           0,
  pageSize:       30,
  searchQuery:    '',
  heroVideo:      null,
  heroInterval:   null,
  hlsInstance:    null,   // HLS.js player instance
}

function openSourceModal() {
  const overlay = DOM.sourcePanel;
  if (overlay) {
    overlay.classList.add('open');
    document.body.style.overflow = 'hidden';
    const search = DOM.sourceSearch;
    if (search) {
      search.value = '';
      renderPlaylists();
      setTimeout(() => search.focus(), 100);
    }
  }
}

function closeSourceModal(e) {
  const overlay = DOM.sourcePanel;
  const closeBtn = $('source-modal-close-btn');
  if (e && e.target !== overlay && e.target !== closeBtn && (!closeBtn || !closeBtn.contains(e.target))) return;
  if (overlay) {
    overlay.classList.remove('open');
    if (!DOM.modalOverlay.classList.contains('open')) {
      document.body.style.overflow = '';
    }
  }
};

// ── DOM Refs ────────────────────────────────────────
const $ = (id) => document.getElementById(id);
const DOM = {
  header:        $('site-header'),
  heroBg:        $('hero-bg'),
  heroTitle:     $('hero-title'),
  heroDesc:      $('hero-desc'),
  heroPlayBtn:   $('hero-play-btn'),
  heroInfoBtn:   $('hero-info-btn'),
  navTabs:       $('nav-tabs'),
  filterScroll:  $('filter-scroll'),
  videoGrid:     $('video-grid'),
  sectionTitle:  $('section-title'),
  videoCount:    $('video-count'),
  loadMoreBtn:   $('load-more-btn'),
  sourcePanel:   $('source-modal-overlay'),
  sourceSearch:  $('source-search'),
  sourceList:    $('source-list'),
  searchInput:   $('search-input'),
  // Modal
  modalOverlay:  $('modal-overlay'),
  modalTitle:    $('modal-title'),
  modalMetaCode: $('modal-meta-code'),
  modalGroupTag: $('modal-group-tag'),
  videoPlayer:   $('video-player'),
  playerLoading: $('player-loading'),
  relatedGrid:   $('related-grid'),
  toast:         $('toast'),
};

// ── Init ─────────────────────────────────────────────
document.addEventListener('DOMContentLoaded', () => {
  initApp();
  setupEventListeners();
});

async function initApp() {
  // Load playlist index
  try {
    const resp = await fetch('playlists_index.json');
    if (!resp.ok) throw new Error('Cannot load playlists_index.json');
    state.playlists = await resp.ok ? await resp.json() : [];
    
    if (state.playlists.length === 0) {
      throw new Error('No playlists found in index');
    }
    
    renderPlaylists();
    // Load the first playlist by default
    loadPlaylist(0);
  } catch (err) {
    console.error('App init error:', err);
    showToast('❌ �������ö��Ŵ��ª���������ʵ���: ' + err.message);
    DOM.videoGrid.innerHTML = `
      <div class="empty-state">
        <div class="emoji">⚠️</div>
        <p>��辺���������ʵ�������� playlists/</p>
      </div>`;
  }
}

function setupEventListeners() {
  // Header scroll effect
  window.addEventListener('scroll', () => {
    DOM.header.classList.toggle('scrolled', window.scrollY > 60);
  });

  // Search videos
  DOM.searchInput.addEventListener('input', (e) => {
    state.searchQuery = e.target.value.trim().toLowerCase();
    applyFilter();
  });

  // Search playlists inside source panel
  DOM.sourceSearch.addEventListener('input', (e) => {
    const query = e.target.value.trim().toLowerCase();
    renderPlaylists(query);
  });

  // Source toggle panel
  $('toggle-source-btn').addEventListener('click', () => {
    openSourceModal();
  });

  // Keyboard controls
  document.addEventListener('keydown', (e) => {
    if (e.key === 'Escape') closeModal();
    if (e.key === 'ArrowLeft') navigateVideo(-1);
    if (e.key === 'ArrowRight') navigateVideo(1);
  });

  // Video player loading states
  DOM.videoPlayer.addEventListener('waiting', () => {
    DOM.playerLoading.classList.add('show');
  });
  DOM.videoPlayer.addEventListener('canplay', () => {
    DOM.playerLoading.classList.remove('show');
  });
  DOM.videoPlayer.addEventListener('error', () => {
    DOM.playerLoading.classList.remove('show');
    showToast('⚠️ �������ö������ʵ�����觹���� �����ԧ���������');
  });

  // Logo resets to "all"
  $('logo-btn').addEventListener('click', () => {
    setActiveGroup('all');
  });
}

// ── Render Playlists in Panel ─────────────────────────
function renderPlaylists(searchQuery = '') {
  let list = state.playlists;
  if (searchQuery) {
    list = list.filter(p => p.name.toLowerCase().includes(searchQuery));
  }

  DOM.sourceList.innerHTML = list.map((p, idx) => {
    const origIdx = state.playlists.indexOf(p);
    const activeClass = origIdx === state.playlistIdx ? 'active' : '';
    // Use general video thumbnail, fallback icons
    const icon = p.type === 'm3u' ? '📺' : '📁';
    
    return `
      <div class="source-item ${activeClass}" onclick="switchPlaylist(${origIdx})">
        <div style="font-size: 24px; padding: 4px; border-radius: 8px; background: rgba(255,255,255,0.05);">${icon}</div>
        <div style="flex: 1; min-width: 0;">
          <div class="source-name" title="${escHtml(p.name)}">${escHtml(p.name)}</div>
          <div class="source-file" title="${escHtml(p.originalName)}">${escHtml(p.originalName)}</div>
        </div>
        <span class="source-badge ${p.type}">${p.type}</span>
      </div>
    `;
  }).join('');
}

function switchPlaylist(idx) {
  if (idx === state.playlistIdx) return;
  clearInterval(state.heroInterval);
  loadPlaylist(idx);
  closeSourceModal();
  showToast(`📂 ��Ŵ������ʵ�: ${state.playlists[idx].name}`);
}

// ── Load & Parse Playlist ────────────────────────────
async function loadPlaylist(idx) {
  state.playlistIdx = idx;
  const pl = state.playlists[idx];

  // Refresh panel list active state
  renderPlaylists();

  // Reset page state
  DOM.videoGrid.innerHTML = '';
  state.allVideos = [];
  state.filteredVideos = [];
  state.page = 0;
  state.activeGroup = 'all';
  state.searchQuery = '';
  DOM.searchInput.value = '';
  const tabInputReset = document.getElementById('tab-search-input');
  if (tabInputReset) tabInputReset.value = '';
  const clearBtnReset = document.getElementById('search-clear-btn');
  if (clearBtnReset) clearBtnReset.classList.remove('visible');

  renderSkeletons(12);

  try {
    const resp = await fetch(pl.file);
    if (!resp.ok) throw new Error('HTTP ' + resp.status);
    const parsedData = await resp.json();
    state.data = parsedData;
    processData(parsedData);
  } catch (err) {
    console.error('Playlist load error:', err);
    showToast('❌ �������ö��ҹ�������: ' + err.message);
    DOM.videoGrid.innerHTML = `
      <div class="empty-state">
        <div class="emoji">⚠️</div>
        <p>�������ö��ҹ��������ç���ҧ������ʵ��������</p>
      </div>`;
    DOM.loadMoreBtn.style.display = 'none';
    DOM.videoCount.textContent = '';
  }
}

// ── Process Data into States ───────────────────────────
function processData(json) {
  const flat = [];
  let groups = json.groups || [];

  // Case: No groups but directly has stations (flat JSON style)
  if (!groups.length && json.stations && Array.isArray(json.stations)) {
    groups = [{ name: '�Դ��ͷ�����', stations: json.stations }];
  }

  groups.forEach((group) => {
    const gName = group.name || '�����';
    const stations = group.stations || [];
    
    stations.forEach((s) => {
      // Validate that URL exists
      if (s.url && s.url.startsWith('http') && s.url.length > 12) {
        flat.push({
          name:  s.name  || '����ժ���',
          image: s.image || '',
          url:   s.url,
          group: gName,
          code:  s.code || extractCode(s.name),
        });
      }
    });
  });

  state.allVideos = flat;
  state.filteredVideos = [...flat];

  renderHero(flat);
  renderNavTabs(json);
  renderGroupFilter(groups);
  renderVideos(true);
}

function extractCode(name) {
  const m = name && name.match(/\b([A-Z0-9]+-\d+)\b/i);
  return m ? m[1].toUpperCase() : '';
}

// ── Hero Banner ────────────────────────────────────────
function renderHero(videos) {
  if (!videos.length) {
    DOM.heroBg.style.backgroundImage = '';
    DOM.heroTitle.textContent = '����բ������Դ���';
    DOM.heroDesc.textContent = '��س����͡���觢��������';
    DOM.heroPlayBtn.onclick = null;
    DOM.heroInfoBtn.onclick = null;
    return;
  }

  const withImg = videos.filter((v) => v.image && v.image.startsWith('http'));
  const pool = withImg.length ? withImg : videos;
  
  const pick = pool[Math.floor(Math.random() * Math.min(pool.length, 25))];
  state.heroVideo = pick;

  DOM.heroBg.style.backgroundImage = `url('${pick.image || generatePlaceholder(pick.name)}')`;
  DOM.heroTitle.textContent = pick.name;
  DOM.heroDesc.textContent = pick.group + ' � ' + (pick.code || 'HD Stream');

  DOM.heroBg.classList.add('zooming');

  DOM.heroPlayBtn.onclick = () => openModal(pick, state.filteredVideos.indexOf(pick));
  DOM.heroInfoBtn.onclick = () => openModal(pick, state.filteredVideos.indexOf(pick));

  // Auto rotate banner
  clearInterval(state.heroInterval);
  let heroIdx = 0;
  state.heroInterval = setInterval(() => {
    if (!state.filteredVideos.length) return;
    heroIdx = (heroIdx + 1) % Math.min(pool.length, 25);
    const next = pool[heroIdx];
    if (!next) return;
    state.heroVideo = next;
    DOM.heroBg.style.backgroundImage = `url('${next.image || generatePlaceholder(next.name)}')`;
    DOM.heroTitle.textContent = next.name;
    DOM.heroDesc.textContent = next.group + ' � ' + (next.code || 'HD Stream');
    DOM.heroPlayBtn.onclick = () => openModal(next, state.filteredVideos.indexOf(next));
    DOM.heroInfoBtn.onclick = () => openModal(next, state.filteredVideos.indexOf(next));
  }, 9000);
}

// ── Navbar Header Tabs ─────────────────────────────────
function renderNavTabs(json) {
  const plName = state.playlists[state.playlistIdx].name;
  DOM.navTabs.innerHTML = `
    <button class="nav-tab active" onclick="setActiveGroup('all')">
      🎬 ${plName}
    </button>
  `;
}

// ── Group Filters ──────────────────────────────────────
function renderGroupFilter(groups) {
  // Remove empty groups
  const uniqueGroups = groups
    .filter(g => g.stations && g.stations.length > 0)
    .map(g => g.name);

  DOM.filterScroll.innerHTML = `
    <button class="filter-chip active" id="chip-all" onclick="setActiveGroup('all')">
      🎬 ������
    </button>
    ${uniqueGroups.map((g, i) => `
      <button class="filter-chip" id="chip-${i}" onclick="setActiveGroup('${escHtml(g)}')">
        ${g}
      </button>
    `).join('')}
  `;
}

function setActiveGroup(group) {
  state.activeGroup = group;
  state.page = 0;

  // Highlight active chips
  document.querySelectorAll('.filter-chip').forEach((el) => {
    const isAll = group === 'all' && el.id === 'chip-all';
    const isMatch = el.textContent.trim().includes(group);
    el.classList.toggle('active', isAll || (group !== 'all' && isMatch));
  });

  applyFilter();
}

// ── Apply Query and Filters ───────────────────────────
function applyFilter() {
  let videos = [...state.allVideos];

  if (state.activeGroup !== 'all') {
    videos = videos.filter((v) => v.group === state.activeGroup);
  }
  if (state.searchQuery) {
    videos = videos.filter((v) =>
      v.name.toLowerCase().includes(state.searchQuery) ||
      (v.code && v.code.toLowerCase().includes(state.searchQuery))
    );
  }

  state.filteredVideos = videos;
  state.page = 0;
  renderVideos(true);
}

// ── Render Video Grid ──────────────────────────────────
function renderVideos(reset = false) {
  if (reset) DOM.videoGrid.innerHTML = '';

  const start = state.page * state.pageSize;
  const end   = start + state.pageSize;
  const slice = state.filteredVideos.slice(start, end);

  if (state.filteredVideos.length === 0) {
    DOM.videoGrid.innerHTML = `
      <div class="empty-state">
        <div class="emoji">🔍</div>
        <p>��辺�Դ��ͷ��������Ǵ������</p>
      </div>`;
    DOM.loadMoreBtn.style.display = 'none';
    DOM.videoCount.textContent = '';
    return;
  }

  DOM.videoCount.textContent = `${state.filteredVideos.length} ��¡��`;
  DOM.sectionTitle.textContent =
    state.activeGroup === 'all' ? '��¡�÷�����' : state.activeGroup;

  slice.forEach((video, i) => {
    const globalIdx = start + i;
    const card = createVideoCard(video, globalIdx);
    DOM.videoGrid.appendChild(card);
  });

  // Load more check
  const hasMore = end < state.filteredVideos.length;
  DOM.loadMoreBtn.style.display = hasMore ? 'block' : 'none';
}

function createVideoCard(video, idx) {
  const card = document.createElement('div');
  card.className = 'video-card';
  card.style.animationDelay = `${(idx % state.pageSize) * 20}ms`;

  const thumbSrc = video.image || generatePlaceholder(video.name);
  const extension = video.url.includes('.m3u8') ? 'M3U8' : 'MP4';

  card.innerHTML = `
    <div class="card-thumb">
      <img
        src="${escHtml(thumbSrc)}"
        alt="${escHtml(video.name)}"
        loading="lazy"
        onerror="this.src='data:image/svg+xml,<svg xmlns=%22http://www.w3.org/2000/svg%22 width=%22320%22 height=%22200%22><rect fill=%22%231a1a28%22 width=%22320%22 height=%22200%22/><text x=%2250%25%22 y=%2250%25%22 fill=%22%23606080%22 font-size=%2248%22 text-anchor=%22middle%22 dominant-baseline=%22middle%22>🎬</text></svg>'"
      />
      <div class="card-play-overlay">
        <div class="card-play-btn">▶</div>
      </div>
      ${video.code ? `<span class="card-badge">${escHtml(video.code)}</span>` : ''}
      <span class="card-duration">${extension}</span>
    </div>
    <div class="card-body">
      ${video.code ? `<div class="card-code">${escHtml(video.code)}</div>` : ''}
      <div class="card-title">${escHtml(video.name)}</div>
      <div class="card-meta">
        <span class="card-group">${escHtml(video.group)}</span>
        <span class="card-hd">HD</span>
      </div>
    </div>
  `;

  card.addEventListener('click', () => openModal(video, idx));
  return card;
}

function generatePlaceholder(name) {
  return `data:image/svg+xml,<svg xmlns="http://www.w3.org/2000/svg" width="320" height="200"><rect fill="%231a1a28" width="320" height="200"/><text x="50%" y="50%" fill="%23606080" font-size="48" text-anchor="middle" dominant-baseline="middle">🎬</text></svg>`;
}

function loadMore() {
  state.page++;
  renderVideos(false);
}

// ── Skeletons ──────────────────────────────────────────
function renderSkeletons(count) {
  DOM.videoGrid.innerHTML = Array.from({ length: count }, () => `
    <div class="skeleton-card">
      <div class="skeleton skeleton-thumb"></div>
      <div class="skeleton-body">
        <div class="skeleton skeleton-line short"></div>
        <div class="skeleton skeleton-line"></div>
        <div class="skeleton skeleton-line" style="width: 70%;"></div>
        <div class="skeleton skeleton-line" style="width: 50%;"></div>
      </div>
    </div>
  `).join('');
}

// ── Video Player Modal ─────────────────────────────────
function openModal(video, idx) {
  state.currentVideo = video;
  state.currentIndex = idx >= 0 ? idx : state.filteredVideos.indexOf(video);

  DOM.modalTitle.textContent    = video.name;
  DOM.modalGroupTag.textContent = video.group;
  DOM.modalMetaCode.textContent = video.code ? `����˹ѧ: ${video.code}` : '';

  // Reset video player and load video poster
  DOM.videoPlayer.poster = video.image || '';
  DOM.playerLoading.classList.add('show');
  
  // Stream Playback Logic (.m3u8 vs .mp4)
  playStream(video.url);

  // Load related channels
  renderRelated(video);

  // Set modal navigations
  $('btn-prev').disabled = state.currentIndex <= 0;
  $('btn-next').disabled = state.currentIndex >= state.filteredVideos.length - 1;

  DOM.modalOverlay.classList.add('open');
  document.body.style.overflow = 'hidden';
}

function playStream(url) {
  // Clear any existing HLS instances
  if (state.hlsInstance) {
    state.hlsInstance.destroy();
    state.hlsInstance = null;
  }

  const isHls = url.includes('.m3u8') || url.includes('/playlist');

  if (isHls) {
    if (Hls.isSupported()) {
      state.hlsInstance = new Hls({
        maxMaxBufferLength: 15,
        enableWorker: true
      });
      state.hlsInstance.loadSource(url);
      state.hlsInstance.attachMedia(DOM.videoPlayer);
      state.hlsInstance.on(Hls.Events.MANIFEST_PARSED, () => {
        DOM.videoPlayer.play().catch(() => {});
      });
      state.hlsInstance.on(Hls.Events.ERROR, function (event, data) {
        if (data.fatal) {
          switch (data.type) {
            case Hls.ErrorTypes.NETWORK_ERROR:
              state.hlsInstance.startLoad();
              break;
            case Hls.ErrorTypes.MEDIA_ERROR:
              state.hlsInstance.recoverMediaError();
              break;
            default:
              break;
          }
        }
      });
    } else if (DOM.videoPlayer.canPlayType('application/vnd.apple.mpegurl')) {
      // Native Apple HLS streaming (Safari / iOS)
      DOM.videoPlayer.src = url;
      DOM.videoPlayer.load();
      DOM.videoPlayer.play().catch(() => {});
    } else {
      DOM.playerLoading.classList.remove('show');
      showToast('⚠️ ���������ͧ�س����ͧ�Ѻ��������� HLS (.m3u8)');
    }
  } else {
    // Normal MP4 file playback
    DOM.videoPlayer.src = url;
    DOM.videoPlayer.load();
    DOM.videoPlayer.play().catch(() => {});
  }
}

function closeModal(e) {
  if (e && e.target !== DOM.modalOverlay) return;
  DOM.modalOverlay.classList.remove('open');
  
  if (state.hlsInstance) {
    state.hlsInstance.destroy();
    state.hlsInstance = null;
  }
  
  DOM.videoPlayer.pause();
  DOM.videoPlayer.removeAttribute('src');
  DOM.videoPlayer.load();
  document.body.style.overflow = '';
}

function navigateVideo(dir) {
  const newIdx = state.currentIndex + dir;
  if (newIdx < 0 || newIdx >= state.filteredVideos.length) return;
  openModal(state.filteredVideos[newIdx], newIdx);
}

function renderRelated(current) {
  const pool = state.filteredVideos
    .filter((v) => v !== current && v.group === current.group)
    .slice(0, 8);

  if (!pool.length) {
    $('related-videos').style.display = 'none';
    return;
  }
  $('related-videos').style.display = 'block';

  DOM.relatedGrid.innerHTML = pool.map((v, i) => `
    <div class="related-card" onclick="openModal(state.filteredVideos[${state.filteredVideos.indexOf(v)}], ${state.filteredVideos.indexOf(v)})">
      <div class="related-thumb">
        <img
          src="${escHtml(v.image || '')}"
          alt="${escHtml(v.name)}"
          loading="lazy"
          onerror="this.src='data:image/svg+xml,<svg xmlns=%22http://www.w3.org/2000/svg%22 width=%22160%22 height=%22100%22><rect fill=%22%231a1a28%22 width=%22160%22 height=%22100%22/><text x=%2250%25%22 y=%2250%25%22 fill=%22%23606080%22 font-size=%2230%22 text-anchor=%22middle%22 dominant-baseline=%22middle%22>🎬</text></svg>'"
        />
      </div>
      <div class="related-title">${escHtml(v.name)}</div>
    </div>
  `).join('');
}

// ── Actions ────────────────────────────────────────────
function copyVideoUrl() {
  if (!state.currentVideo) return;
  navigator.clipboard.writeText(state.currentVideo.url)
    .then(() => showToast('✅ �Ѵ�͡�ԧ���Դ�������'))
    .catch(() => showToast('❌ �������ö�Ѵ�͡��'));
}

// ── Toast Notifications ─────────────────────────────────
let toastTimer = null;
function showToast(msg) {
  DOM.toast.textContent = msg;
  DOM.toast.classList.add('show');
  clearTimeout(toastTimer);
  toastTimer = setTimeout(() => DOM.toast.classList.remove('show'), 2800);
}

// ── HTML Escape Utility ─────────────────────────────────
function escHtml(str) {
  return String(str || '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}
