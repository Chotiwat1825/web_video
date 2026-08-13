/* ===================================================
   PlayIDTV — App Logic (Enhanced Edition)
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
  lastScrollY:    0,      // last scroll position before modal opens
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

// ── SVG Icons ──────────────────────────────────────
const SVG_ICONS = {
  play: `<svg class="svg-icon" viewBox="0 0 24 24"><path d="M8 5v14l11-7z"/></svg>`,
  search: `<svg class="svg-icon" viewBox="0 0 24 24"><path d="M15.5 14h-.79l-.28-.27C15.41 12.59 16 11.11 16 9.5 16 5.91 13.09 3 9.5 3S3 5.91 3 9.5 5.91 16 9.5 16c1.61 0 3.09-.59 4.23-1.57l.27.28v.79l5 4.99L20.49 19l-4.99-5zm-6 0C7.01 14 5 11.99 5 9.5S7.01 5 9.5 5 14 7.01 14 9.5 11.99 14 9.5 14z"/></svg>`,
  folder: `<svg class="svg-icon" viewBox="0 0 24 24"><path d="M10 4H4c-1.1 0-1.99.9-1.99 2L2 18c0 1.1.9 2 2 2h16c1.1 0 2-.9 2-2V8c0-1.1-.9-2-2-2h-8l-2-2z"/></svg>`,
  folder_open: `<svg class="svg-icon" viewBox="0 0 24 24"><path d="M20 6h-8l-2-2H4c-1.1 0-1.99.9-1.99 2L2 18c0 1.1.9 2 2 2h16c1.1 0 2-.9 2-2V8c0-1.1-.9-2-2-2zm0 12H4V8h16v10z"/></svg>`,
  movie: `<svg class="svg-icon" viewBox="0 0 24 24"><path d="M18 4l2 4h-3l-2-4h-2l2 4h-3l-2-4H8l2 4H7L5 4H4c-1.1 0-1.99.9-1.99 2L2 18c0 1.1.9 2 2 2h16c1.1 0 2-.9 2-2V4h-4z"/></svg>`,
  tv: `<svg class="svg-icon" viewBox="0 0 24 24"><path d="M21 3H3c-1.1 0-2 .9-2 2v12c0 1.1.9 2 2 2h5v2h8v-2h5c1.1 0 1.99-.9 1.99-2L23 5c0-1.1-.9-2-2-2zm0 14H3V5h18v12z"/></svg>`,
  whatshot: `<svg class="svg-icon" viewBox="0 0 24 24"><path d="M13.5.67s.74 2.65.74 4.8c0 2.06-1.35 3.73-3.41 3.73-2.07 0-3.63-1.67-3.63-3.73l.03-.36C5.21 7.51 4 10.62 4 14c0 4.42 3.58 8 8 8s8-3.58 8-8C20 8.61 17.41 3.8 13.5.67zM12 20c-3.13 0-5.5-2.37-5.5-5.5 0-2.31 1.25-4.5 3.2-5.46.06.84.45 1.63 1.13 2.18.66.52 1.5.8 2.37.8 1.49 0 2.8-1.21 2.8-2.7 0-.32-.05-.62-.12-.9.76 1.48 1.62 3.4 1.62 5.58 0 3.13-2.37 5.5-5.5 5.5z"/></svg>`,
  info: `<svg class="svg-icon" viewBox="0 0 24 24"><path d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm1 15h-2v-6h2v6zm0-8h-2V7h2v2z"/></svg>`,
  arrow_downward: `<svg class="svg-icon" viewBox="0 0 24 24"><path d="M20 12l-1.41-1.41L13 16.17V4h-2v12.17l-5.58-5.59L4 12l8 8 8-8z"/></svg>`,
  close: `<svg class="svg-icon" viewBox="0 0 24 24"><path d="M19 6.41L17.59 5 12 10.59 6.41 5 5 6.41 10.59 12 5 17.59 6.41 19 12 13.41 17.59 19 19 17.59 13.41 12z"/></svg>`,
  navigate_before: `<svg class="svg-icon" viewBox="0 0 24 24"><path d="M15.41 7.41L14 6l-6 6 6 6 1.41-1.41L10.83 12z"/></svg>`,
  navigate_next: `<svg class="svg-icon" viewBox="0 0 24 24"><path d="M10 6L8.59 7.41 13.17 12l-4.58 4.59L10 18l6-6z"/></svg>`,
  link: `<svg class="svg-icon" viewBox="0 0 24 24"><path d="M3.9 12c0-1.71 1.39-3.1 3.1-3.1h4V7H7c-2.76 0-5 2.24-5 5s2.24 5 5 5h4v-1.9H7c-1.71 0-3.1-1.39-3.1-3.1zM8 13h8v-2H8v2zm9-6h-4v1.9h4c1.71 0 3.1 1.39 3.1 3.1s-1.39 3.1-3.1 3.1h-4V17h4c2.76 0 5-2.24 5-5s-2.24-5-5-5z"/></svg>`,
  cancel: `<svg class="svg-icon" viewBox="0 0 24 24"><path d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm1 15h-2v-2h2v2zm0-4h-2V7h2v6z"/></svg>`,
  warning: `<svg class="svg-icon" viewBox="0 0 24 24"><path d="M1 21h22L12 2 1 21zm12-3h-2v-2h2v2zm0-4h-2v-4h2v4z"/></svg>`,
  check_circle: `<svg class="svg-icon" viewBox="0 0 24 24"><path d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm-2 15l-5-5 1.41-1.41L10 14.17l7.59-7.59L19 8l-9 9z"/></svg>`,
};

function getIcon(name) {
  return SVG_ICONS[name] || '';
}

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
  paginationWrap: $('pagination-wrap'),
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
    showToast(getIcon('cancel') + ' <span>ไม่สามารถโหลดรายชื่อเพลย์ลิสต์ได้: ' + escHtml(err.message) + '</span>');
    DOM.videoGrid.innerHTML = `
      <div class="empty-state">
        ${getIcon('warning')}
        <p>ไม่พบไฟล์เพลย์ลิสต์ในโฟลเดอร์ playlists/</p>
      </div>`;
  }
}

function setupEventListeners() {
  // Header scroll effect & Scroll progress bar
  window.addEventListener('scroll', () => {
    const scrollTop = window.scrollY;
    DOM.header.classList.toggle('scrolled', scrollTop > 60);

    const docHeight = document.documentElement.scrollHeight - window.innerHeight;
    const scrolled = docHeight > 0 ? (scrollTop / docHeight) * 100 : 0;
    const bar = $('scroll-progress-bar');
    if (bar) bar.style.width = scrolled + '%';
  });

  // Search videos — with debounce
  const debouncedSearch = debounce((value) => {
    state.searchQuery = value.trim().toLowerCase();
    if (state.searchQuery) saveRecentSearch(state.searchQuery);
    // Keep mobile tab input in sync
    const tabInput = document.getElementById('tab-search-input');
    if (tabInput) tabInput.value = value;
    applyFilter();
  }, 200);

  DOM.searchInput.addEventListener('input', (e) => {
    debouncedSearch(e.target.value);
    // Show/hide clear button immediately (no debounce needed)
    const clearBtn = document.getElementById('search-clear-btn');
    if (clearBtn) clearBtn.classList.toggle('visible', e.target.value.length > 0);
  });

  // Clear button
  const clearBtn = document.getElementById('search-clear-btn');
  if (clearBtn) {
    clearBtn.addEventListener('click', () => clearSearch());
  }

  // Keyboard shortcut: '/' or Ctrl+K → focus desktop search
  document.addEventListener('keydown', (e) => {
    const tag = e.target.tagName;
    if (['INPUT', 'TEXTAREA'].includes(tag)) return;
    if (e.key === '/' || (e.ctrlKey && e.key === 'k')) {
      e.preventDefault();
      DOM.searchInput.focus();
      DOM.searchInput.select();
    }
  });

  // Search playlists inside source panel — with debounce
  const debouncedSourceSearch = debounce((value) => {
    renderPlaylists(value);
  }, 150);

  DOM.sourceSearch.addEventListener('input', (e) => {
    debouncedSourceSearch(e.target.value.trim().toLowerCase());
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
    showToast('⚠️ ไม่สามารถเล่นไฟล์สตรีมมิ่งนี้ได้ หรือลิงก์หมดอายุ');
  });

  // Logo resets to "all"
  $('logo-btn').addEventListener('click', () => {
    setActiveGroup('all');
  });
}

// ── Custom Player Controls ────────────────────────────
let _hideControlsTimer = null;

function initPlayerControls() {
  const wrap          = $('player-wrap');
  const video         = DOM.videoPlayer;
  const seek          = $('player-seek');
  const progressFill  = $('player-progress-fill');
  const progressThumb = $('player-progress-thumb');
  const buffered      = $('player-buffered');
  const timeEl        = $('player-time');
  const volSlider     = $('player-volume');

  // ── Auto-hide controls ──────────────────────────────
  function showControls() {
    wrap.classList.add('controls-visible');
    clearTimeout(_hideControlsTimer);
    if (!video.paused) {
      _hideControlsTimer = setTimeout(() => {
        wrap.classList.remove('controls-visible');
      }, 3000);
    }
  }
  wrap.addEventListener('mousemove', showControls);
  wrap.addEventListener('touchstart', showControls, { passive: true });
  wrap.addEventListener('mouseleave', () => {
    if (!video.paused) {
      clearTimeout(_hideControlsTimer);
      wrap.classList.remove('controls-visible');
    }
  });
  // Always show when paused
  video.addEventListener('pause', () => {
    wrap.classList.add('controls-visible');
    clearTimeout(_hideControlsTimer);
  });
  video.addEventListener('play', () => { showControls(); });

  // ── Gesture Controls (replaces center-click) ───────
  initGestureControls();

  // ── Play/Pause button ───────────────────────────────
  $('btn-play-pause').addEventListener('click', (e) => {
    e.stopPropagation();
    togglePlayPause();
  });
  video.addEventListener('play', updatePlayIcon);
  video.addEventListener('pause', updatePlayIcon);
  video.addEventListener('ended', updatePlayIcon);

  // ── Skip buttons ────────────────────────────────────
  $('btn-skip-back').addEventListener('click', (e) => { e.stopPropagation(); doSkip(-5, 'left'); });
  $('btn-skip-fwd').addEventListener('click', (e) => { e.stopPropagation(); doSkip(5, 'right'); });

  // ── Playback Speed button ───────────────────────────
  const speedBtn = $('btn-speed');
  const speedMenu = $('player-speed-menu');
  
  if (speedBtn && speedMenu) {
    speedBtn.addEventListener('click', (e) => {
      e.stopPropagation();
      speedMenu.classList.toggle('show');
    });

    document.addEventListener('click', (e) => {
      if (speedMenu.classList.contains('show') && !speedMenu.contains(e.target) && e.target !== speedBtn) {
        speedMenu.classList.remove('show');
      }
    });

    const speedItems = speedMenu.querySelectorAll('.speed-menu-item');
    speedItems.forEach(item => {
      item.addEventListener('click', (e) => {
        e.stopPropagation();
        const speed = parseFloat(item.dataset.speed);
        setPlaybackSpeed(speed);
        speedMenu.classList.remove('show');
      });
    });
  }

  document.addEventListener('keydown', (ev) => {
    if (ev.key === 's' && DOM.modalOverlay.classList.contains('open') &&
        !['INPUT','TEXTAREA'].includes(ev.target.tagName)) cycleSpeed();
  });

  // ── Lock Screen button ───────────────────────────────
  $('btn-lock').addEventListener('click', (e) => { e.stopPropagation(); toggleLockScreen(); });
  $('btn-lock-unlock').addEventListener('click', (e) => { e.stopPropagation(); toggleLockScreen(); });

  // ── Seek (progress bar) ─────────────────────────────
  seek.addEventListener('input', () => {
    const pct = seek.value / 100;
    if (video.duration) {
      video.currentTime = pct * video.duration;
    }
    updateProgressUI(pct);
  });
  video.addEventListener('timeupdate', onTimeUpdate);
  video.addEventListener('progress', onBufferUpdate);

  // ── Seek Tooltip & Hover/Scrubbing UI (YouTube style) ─
  const seekWrap = $('player-progress-wrap');
  const seekTooltip = $('player-progress-tooltip');

  if (seekWrap && seekTooltip) {
    const handleSeekHover = (clientX) => {
      if (!video.duration) return;
      const rect = seekWrap.getBoundingClientRect();
      const padding = 16;
      const activeWidth = rect.width - (padding * 2);
      
      // Calculate cursor X relative to progress bar active area
      let mouseX = clientX - rect.left - padding;
      mouseX = Math.max(0, Math.min(activeWidth, mouseX));
      
      const pct = mouseX / activeWidth;
      const targetTime = pct * video.duration;
      
      seekTooltip.textContent = formatTime(targetTime);
      seekTooltip.style.left = (mouseX + padding) + 'px';
    };

    seek.addEventListener('mousemove', (e) => {
      handleSeekHover(e.clientX);
    });

    seek.addEventListener('touchmove', (e) => {
      if (e.touches && e.touches[0]) {
        handleSeekHover(e.touches[0].clientX);
      }
    }, { passive: true });

    // Handle class toggles for thick bar and persistent tooltip during scrubbing
    seek.addEventListener('mousedown', () => {
      seekWrap.classList.add('scrubbing');
    });
    document.addEventListener('mouseup', () => {
      seekWrap.classList.remove('scrubbing');
    });
    seek.addEventListener('touchstart', () => {
      seekWrap.classList.add('scrubbing');
    });
    document.addEventListener('touchend', () => {
      seekWrap.classList.remove('scrubbing');
    });
  }

  // ── Volume slider ───────────────────────────────────
  volSlider.addEventListener('input', (e) => {
    e.stopPropagation();
    video.volume = parseFloat(volSlider.value);
    video.muted  = (video.volume === 0);
    updateVolumeUI();
  });
  $('btn-mute').addEventListener('click', (e) => { e.stopPropagation(); toggleMute(); });
  video.addEventListener('volumechange', updateVolumeUI);

  // ── Fullscreen ──────────────────────────────────────
  $('btn-fullscreen').addEventListener('click', (e) => { e.stopPropagation(); toggleFullscreen(); });
  document.addEventListener('fullscreenchange', updateFullscreenIcon);
  document.addEventListener('webkitfullscreenchange', updateFullscreenIcon);

  // ── Picture-in-Picture ──────────────────────────────
  $('btn-pip').addEventListener('click', async (e) => {
    e.stopPropagation();
    try {
      if (document.pictureInPictureElement) {
        await document.exitPictureInPicture();
      } else if (video.requestPictureInPicture) {
        await video.requestPictureInPicture();
      }
    } catch (err) {
      console.warn('PiP not supported:', err);
    }
  });
}

// ── Player Helpers ───────────────────────────────────
function togglePlayPause() {
  const v = DOM.videoPlayer;
  if (v.paused || v.ended) {
    v.play().catch(() => {});
    triggerCenterActionOverlay('play');
  } else {
    v.pause();
    triggerCenterActionOverlay('pause');
  }
}

function triggerCenterActionOverlay(type) {
  const el = $('action-icon-wrap');
  if (!el) return;

  const playSvg = `<svg class="svg-icon" viewBox="0 0 24 24"><path d="M8 5v14l11-7z"/></svg>`;
  const pauseSvg = `<svg class="svg-icon" viewBox="0 0 24 24"><path d="M6 19h4V5H6v14zm8-14v14h4V5h-4z"/></svg>`;

  el.innerHTML = type === 'play' ? playSvg : pauseSvg;
  el.classList.remove('animate');
  void el.offsetWidth; // force reflow
  el.classList.add('animate');
}

function skipBy(seconds) {
  const v = DOM.videoPlayer;
  if (!v.duration) return;
  v.currentTime = Math.max(0, Math.min(v.duration, v.currentTime + seconds));
}

function toggleMute() {
  const v = DOM.videoPlayer;
  v.muted = !v.muted;
}

function toggleFullscreen() {
  const wrap = $('player-wrap');
  if (!document.fullscreenElement && !document.webkitFullscreenElement) {
    (wrap.requestFullscreen || wrap.webkitRequestFullscreen).call(wrap);
  } else {
    (document.exitFullscreen || document.webkitExitFullscreen).call(document);
  }
}

function updatePlayIcon() {
  const v = DOM.videoPlayer;
  $('icon-play').style.display  = (v.paused || v.ended) ? '' : 'none';
  $('icon-pause').style.display = (v.paused || v.ended) ? 'none' : '';
}

function updateVolumeUI() {
  const v = DOM.videoPlayer;
  const isMuted = v.muted || v.volume === 0;
  $('icon-vol-on').style.display  = isMuted ? 'none' : '';
  $('icon-vol-off').style.display = isMuted ? '' : 'none';
  const vol = isMuted ? 0 : v.volume;
  const volEl = $('player-volume');
  if (volEl) {
    volEl.value = vol;
    volEl.style.setProperty('--vol', (vol * 100) + '%');
  }
}

function updateFullscreenIcon() {
  const isFs = !!(document.fullscreenElement || document.webkitFullscreenElement);
  $('icon-fullscreen').style.display      = isFs ? 'none' : '';
  $('icon-fullscreen-exit').style.display = isFs ? '' : 'none';
}

function onTimeUpdate() {
  const v = DOM.videoPlayer;
  if (!v.duration) return;
  const pct = v.currentTime / v.duration;
  updateProgressUI(pct);
  // Sync seek slider
  const seek = $('player-seek');
  if (seek && document.activeElement !== seek) seek.value = pct * 100;
  // Update time text
  const timeEl = $('player-time');
  if (timeEl) timeEl.textContent = formatTime(v.currentTime) + ' / ' + formatTime(v.duration);
}

function onBufferUpdate() {
  const v = DOM.videoPlayer;
  const buf = $('player-buffered');
  const wrap = $('player-progress-wrap');
  if (!v || !buf || !wrap || !v.duration || v.buffered.length === 0) return;
  const buffEnd = v.buffered.end(v.buffered.length - 1);
  const activeWidth = wrap.clientWidth - 32;
  const pct = buffEnd / v.duration;
  buf.style.width = (pct * activeWidth) + 'px';
}

function updateProgressUI(pct) {
  const fill  = $('player-progress-fill');
  const thumb = $('player-progress-thumb');
  const wrap  = $('player-progress-wrap');
  if (!fill || !wrap) return;
  
  const activeWidth = wrap.clientWidth - 32; // 16px padding on each side
  fill.style.width = (pct * activeWidth) + 'px';
  
  if (thumb) {
    thumb.style.left = (16 + pct * activeWidth) + 'px';
  }
}

function triggerRipple() {
  const r = $('player-ripple');
  if (!r) return;
  r.classList.remove('animate');
  void r.offsetWidth; // reflow
  r.classList.add('animate');
}

function formatTime(s) {
  if (!s || isNaN(s)) return '0:00';
  const h = Math.floor(s / 3600);
  const m = Math.floor((s % 3600) / 60);
  const sec = Math.floor(s % 60);
  const mm = String(m).padStart(h ? 2 : 1, '0');
  const ss = String(sec).padStart(2, '0');
  return h ? `${h}:${mm}:${ss}` : `${mm}:${ss}`;
}

// ── Gesture Controls ──────────────────────────────────
const gs = {
  locked: false,
  brightness: 1,        // video CSS brightness
  speedSteps: [0.25, 0.5, 0.75, 1, 1.25, 1.5, 1.75, 2],
  speedIdx: 3,          // default = 1×
  touch: null,          // active touch tracking
  lastTap: { time: 0, zone: '' },
  longPressTimer: null,
  gestureType: null,    // 'seek' | 'vol' | 'brightness' | null
  seekStartTime: 0,
  swipeHideTimer: null,
  lastTouchTime: 0,
};

let _overlayHideTimers = {};
function hideOverlay(id, delay = 800) {
  clearTimeout(_overlayHideTimers[id]);
  _overlayHideTimers[id] = setTimeout(() => {
    const el = $(id);
    if (el) el.classList.remove('show', 'active', 'left-side');
  }, delay);
}

function initGestureControls() {
  const zones = ['gz-left', 'gz-center', 'gz-right'];
  zones.forEach(id => {
    const el = $(id);
    if (!el) return;
    el.addEventListener('touchstart',  onTouchStart,  { passive: false });
    el.addEventListener('touchmove',   onTouchMove,   { passive: false });
    el.addEventListener('touchend',    onTouchEnd,    { passive: true });
    el.addEventListener('touchcancel', onTouchCancel, { passive: true });
    // Mouse support for desktop drag-seek
    el.addEventListener('mousedown',   onMouseDown);
  });
  // Mouse up anywhere ends scrub
  document.addEventListener('mouseup', onMouseUp);
  document.addEventListener('mousemove', onMouseMoveDoc);
}

// ── Touch handlers ────────────────────────────────────
function onTouchStart(e) {
  if (gs.locked) return; // ignore when locked
  const t = e.touches[0];
  const zone = e.currentTarget.dataset.zone;
  gs.touch = {
    zone,
    startX: t.clientX,
    startY: t.clientY,
    curX: t.clientX,
    curY: t.clientY,
    startTime: Date.now(),
    startVol: DOM.videoPlayer.volume,
    startBrightness: gs.brightness,
    startVideoTime: DOM.videoPlayer.currentTime,
    moved: false,
  };
  gs.gestureType = null;

  // Long-press → 2× speed
  gs.longPressTimer = setTimeout(() => {
    if (!gs.touch || gs.touch.moved) return;
    DOM.videoPlayer.playbackRate = 2;
    const ol = $('speed-boost-overlay');
    const lb = $('speed-boost-label');
    if (ol) { lb.textContent = '2.0×'; ol.classList.add('show'); }
  }, 600);
}

function onTouchMove(e) {
  if (!gs.touch || gs.locked) return;
  e.preventDefault();
  const t = e.touches[0];
  const dx = t.clientX - gs.touch.startX;
  const dy = t.clientY - gs.touch.startY;
  gs.touch.curX = t.clientX;
  gs.touch.curY = t.clientY;

  const THRESHOLD = 12;
  if (!gs.gestureType) {
    if (Math.abs(dx) > THRESHOLD || Math.abs(dy) > THRESHOLD) {
      gs.touch.moved = true;
      clearTimeout(gs.longPressTimer);
      gs.gestureType = Math.abs(dx) > Math.abs(dy) ? 'seek' : (gs.touch.zone === 'left' ? 'brightness' : 'vol');
    }
  }

  if (gs.gestureType === 'seek') handleSeekScrub(dx);
  else if (gs.gestureType === 'vol') handleVolSwipe(dy);
  else if (gs.gestureType === 'brightness') handleBrightnessSwipe(dy);
}

function onTouchEnd(e) {
  if (!gs.touch) return;
  clearTimeout(gs.longPressTimer);

  // Stop long-press 2x
  if (DOM.videoPlayer.playbackRate === 2 && gs.touch.moved === false) {
    DOM.videoPlayer.playbackRate = gs.speedSteps[gs.speedIdx];
    const ol = $('speed-boost-overlay');
    if (ol) hideOverlay('speed-boost-overlay', 0);
  }

  // Hide seek scrub overlay
  if (gs.gestureType === 'seek') {
    hideOverlay('seek-scrub-overlay', 400);
  }
  if (gs.gestureType === 'vol' || gs.gestureType === 'brightness') {
    hideOverlay('swipe-indicator', 700);
  }

  if (!gs.touch.moved) {
    // It's a tap
    const now = Date.now();
    const zone = gs.touch.zone;
    const dt = now - gs.lastTap.time;
    if (dt < 320 && gs.lastTap.zone === zone) {
      // Double-tap
      if (zone === 'left')   doSkip(-10, 'left');
      if (zone === 'right')  doSkip(10, 'right');
      if (zone === 'center') toggleFullscreen();
      gs.lastTap.time = 0; // reset so next tap is fresh
    } else {
      gs.lastTap = { time: now, zone };
      if (zone === 'center') {
        togglePlayPause();
        triggerRipple();
      }
    }
  }

  gs.touch = null;
  gs.gestureType = null;
}

function onTouchCancel() {
  clearTimeout(gs.longPressTimer);
  if (DOM.videoPlayer.playbackRate === 2) {
    DOM.videoPlayer.playbackRate = gs.speedSteps[gs.speedIdx];
    hideOverlay('speed-boost-overlay', 0);
  }
  gs.touch = null;
  gs.gestureType = null;
}

// ── Mouse drag-seek for desktop ───────────────────────
let _mouseScrubbing = false;
let _mouseStartX = 0;
let _mouseStartVT = 0;
function onMouseDown(e) {
  if (gs.locked) return;
  _mouseScrubbing = true;
  _mouseStartX = e.clientX;
  _mouseStartVT = DOM.videoPlayer.currentTime;
  gs.gestureType = 'seek';
}
function onMouseMoveDoc(e) {
  if (!_mouseScrubbing || gs.locked) return;
  const dx = e.clientX - _mouseStartX;
  handleSeekScrub(dx, _mouseStartVT);
}
function onMouseUp() {
  if (_mouseScrubbing) {
    hideOverlay('seek-scrub-overlay', 400);
    _mouseScrubbing = false;
    gs.gestureType = null;
  }
}

// ── Gesture Actions ───────────────────────────────────
function doSkip(secs, side) {
  skipBy(secs);
  const olId = side === 'left' ? 'skip-overlay-left' : 'skip-overlay-right';
  const txtId = side === 'left' ? 'skip-left-text' : 'skip-right-text';
  const ol = $(olId);
  const txt = $(txtId);
  if (!ol) return;
  // Reset animation
  ol.classList.remove('active');
  void ol.offsetWidth;
  if (txt) txt.textContent = `${Math.abs(secs)} วินาที`;
  ol.classList.add('active');
  hideOverlay(olId, 700);
}

function handleSeekScrub(dx, startVT) {
  const v = DOM.videoPlayer;
  if (!v.duration) return;
  const baseVT = (startVT !== undefined) ? startVT : (gs.touch ? gs.touch.startVideoTime : v.currentTime);
  // 1px = 0.3s seek
  const delta = dx * 0.3;
  const newTime = Math.max(0, Math.min(v.duration, baseVT + delta));
  v.currentTime = newTime;

  // Show overlay
  const ol = $('seek-scrub-overlay');
  const deltaEl = $('seek-scrub-delta');
  const posEl   = $('seek-scrub-pos');
  const barEl   = $('seek-scrub-bar');
  if (!ol) return;
  ol.classList.add('show');
  const sign = delta >= 0 ? '+' : '';
  if (deltaEl) deltaEl.textContent = sign + formatTime(Math.abs(delta));
  if (posEl)   posEl.textContent   = formatTime(newTime) + ' / ' + formatTime(v.duration);
  if (barEl)   barEl.style.width   = ((newTime / v.duration) * 100).toFixed(1) + '%';
  clearTimeout(_overlayHideTimers['seek-scrub-overlay']);
}

function handleVolSwipe(dy) {
  const v = DOM.videoPlayer;
  // Swipe up = increase (dy is negative when going up)
  const delta = -(dy / 200);
  const newVol = Math.max(0, Math.min(1, (gs.touch ? gs.touch.startVol : v.volume) + delta));
  v.volume = newVol;
  v.muted = newVol === 0;

  const icons = {
    high:   '<svg class="svg-icon" viewBox="0 0 24 24"><path d="M3 9v6h4l5 5V4L7 9H3zm13.5 3c0-1.77-1.02-3.29-2.5-4.03v8.05c1.48-.73 2.5-2.25 2.5-4.02zM14 3.23v2.06c2.89.86 5 3.54 5 6.71s-2.11 5.85-5 6.71v2.06c4.01-.91 7-4.49 7-8.77s-2.99-7.86-7-8.77z"/></svg>',
    low:    '<svg class="svg-icon" viewBox="0 0 24 24"><path d="M18.5 12c0-1.77-1.02-3.29-2.5-4.03v8.05c1.48-.73 2.5-2.25 2.5-4.02zM5 9v6h4l5 5V4L9 9H5z"/></svg>',
    muted:  '<svg class="svg-icon" viewBox="0 0 24 24"><path d="M16.5 12c0-1.77-1.02-3.29-2.5-4.03v2.21l2.45 2.45c.03-.2.05-.41.05-.63zm2.5 0c0 .94-.2 1.82-.54 2.64l1.51 1.51C20.63 14.91 21 13.5 21 12c0-4.28-2.99-7.86-7-8.77v2.06c2.89.86 5 3.54 5 6.71zM4.27 3L3 4.27 7.73 9H3v6h4l5 5v-6.73l4.25 4.25c-.67.52-1.42.93-2.25 1.18v2.06c1.38-.31 2.63-.95 3.69-1.81L19.73 21 21 19.73l-9-9L4.27 3zM12 4L9.91 6.09 12 8.18V4z"/></svg>',
  };
  const iconHtml = newVol === 0 ? icons.muted : (newVol < 0.5 ? icons.low : icons.high);
  showSwipeIndicator(newVol, iconHtml, 'right', Math.round(newVol * 100) + '%');
  clearTimeout(_overlayHideTimers['swipe-indicator']);
}

function handleBrightnessSwipe(dy) {
  const delta = -(dy / 200);
  gs.brightness = Math.max(0.1, Math.min(2, (gs.touch ? gs.touch.startBrightness : gs.brightness) + delta));
  DOM.videoPlayer.style.filter = `brightness(${gs.brightness})`;
  const pct = Math.round(((gs.brightness - 0.1) / 1.9) * 100);
  const icon = `<svg class="svg-icon" viewBox="0 0 24 24"><path d="M20 8.69V4h-4.69L12 .69 8.69 4H4v4.69L.69 12 4 15.31V20h4.69L12 23.31 15.31 20H20v-4.69L23.31 12 20 8.69zM12 18c-3.31 0-6-2.69-6-6s2.69-6 6-6 6 2.69 6 6-2.69 6-6 6zm0-10c-2.21 0-4 1.79-4 4s1.79 4 4 4 4-1.79 4-4-1.79-4-4-4z"/></svg>`;
  showSwipeIndicator(pct / 100, icon, 'left', pct + '%');
  clearTimeout(_overlayHideTimers['swipe-indicator']);
}

function showSwipeIndicator(value, iconHtml, side, label) {
  const ol = $('swipe-indicator');
  const iconEl = $('swipe-ind-icon');
  const barEl  = $('swipe-ind-bar');
  const lblEl  = $('swipe-ind-label');
  if (!ol) return;
  if (iconEl) iconEl.innerHTML = iconHtml;
  if (barEl)  barEl.style.transform = `scaleY(${value})`;
  if (lblEl)  lblEl.textContent = label;
  ol.classList.toggle('left-side', side === 'left');
  ol.classList.add('show');
}

// ── Speed control ─────────────────────────────────────
function setPlaybackSpeed(speed) {
  const idx = gs.speedSteps.indexOf(speed);
  if (idx !== -1) gs.speedIdx = idx;
  DOM.videoPlayer.playbackRate = speed;
  const lbl = speed === 1 ? '1×' : speed + '×';
  const speedLabel = $('speed-label');
  if (speedLabel) speedLabel.textContent = lbl;
  // Update menu active state
  document.querySelectorAll('.speed-menu-item').forEach(el => {
    el.classList.toggle('active', parseFloat(el.dataset.speed) === speed);
  });
  showToast(`<span>ความเร็ว: ${lbl}</span>`);
}

function cycleSpeed() {
  gs.speedIdx = (gs.speedIdx + 1) % gs.speedSteps.length;
  setPlaybackSpeed(gs.speedSteps[gs.speedIdx]);
}

// ── Lock screen ───────────────────────────────────────
function toggleLockScreen() {
  gs.locked = !gs.locked;
  const overlay = $('lock-screen-overlay');
  const iconLock   = $('icon-lock');
  const iconUnlock = $('icon-unlock');
  if (overlay) overlay.classList.toggle('active', gs.locked);
  if (iconLock)   iconLock.style.display   = gs.locked ? '' : 'none';
  if (iconUnlock) iconUnlock.style.display = gs.locked ? 'none' : '';
  showToast(gs.locked
    ? `<span>🔒 ล็อกหน้าจอแล้ว — แตะเพื่อปลดล็อก</span>`
    : `<span>🔓 ปลดล็อกหน้าจอแล้ว</span>`
  );
}


function renderPlaylists(searchQuery = '') {
  let list = [...state.playlists];
  if (searchQuery) {
    list = list.filter(p => p.name.toLowerCase().includes(searchQuery));
  }

  // Ensure they are sorted by watchable ratio (health) descending
  list.sort((a, b) => {
    const healthA = a.health !== undefined ? a.health : 100;
    const healthB = b.health !== undefined ? b.health : 100;
    if (healthB !== healthA) {
      return healthB - healthA;
    }
    return a.name.localeCompare(b.name, 'th');
  });

  DOM.sourceList.innerHTML = list.map((p) => {
    const origIdx = state.playlists.indexOf(p);
    const activeClass = origIdx === state.playlistIdx ? 'active' : '';
    const icon = p.type === 'm3u' ? getIcon('tv') : getIcon('folder');
    
    // Choose badge color based on health score
    let badgeColor = '#10b981'; // Green (good)
    if (p.health < 30) {
      badgeColor = '#ef4444'; // Red (broken)
    } else if (p.health < 80) {
      badgeColor = '#f59e0b'; // Yellow (partially working)
    }

    const healthText = p.healthScore || '100%';
    const videoCountText = p.workingVideos !== undefined ? `${p.workingVideos}/${p.totalVideos}` : p.totalVideos;

    return `
      <div class="source-item ${activeClass}" onclick="switchPlaylist(${origIdx})">
        <div class="source-item-icon-wrap">${icon}</div>
        <div style="flex: 1; min-width: 0;">
          <div class="source-name" title="${escHtml(p.name)}">${escHtml(p.name)}</div>
          <div class="source-file" title="${escHtml(p.originalName)}">${escHtml(p.originalName)}</div>
        </div>
        <div style="display: flex; flex-direction: column; align-items: flex-end; gap: 4px; margin-left: 8px;">
          <span class="source-badge" style="background-color: ${badgeColor}; color: white; font-weight: bold; font-size: 0.72rem; padding: 2px 6px; border-radius: 4px; min-width: 48px; text-align: center;">
            ${healthText}
          </span>
          <span style="font-size: 0.68rem; color: #888; font-weight: 500;">
            ${videoCountText} vids
          </span>
        </div>
      </div>
    `;
  }).join('');
}

function switchPlaylist(idx) {
  if (idx === state.playlistIdx) return;
  clearInterval(state.heroInterval);
  loadPlaylist(idx);
  closeSourceModal();
  showToast(getIcon('folder_open') + ' <span>โหลดเพลย์ลิสต์: ' + escHtml(state.playlists[idx].name) + '</span>');
}

// ── Load & Parse Playlist ────────────────────────────
async function loadPlaylist(idx) {
  state.playlistIdx = idx;
  const pl = state.playlists[idx];

  // Set hero to loading state
  const heroSec = $('hero-section');
  if (heroSec) heroSec.classList.add('loading');

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
    // Remove loading state on error
    if (heroSec) heroSec.classList.remove('loading');
    showToast(getIcon('cancel') + ' <span>ไม่สามารถอ่านไฟล์นี้ได้: ' + escHtml(err.message) + '</span>');
    DOM.videoGrid.innerHTML = `
      <div class="empty-state">
        ${getIcon('warning')}
        <p>ไม่สามารถอ่านไฟล์หรือโครงสร้างเพลย์ลิสต์เสียหาย</p>
      </div>`;
    if (DOM.paginationWrap) DOM.paginationWrap.innerHTML = '';
    DOM.videoCount.textContent = '';
  }
}

// ── Process Data into States ───────────────────────────
function processData(json) {
  const flat = [];
  let groups = json.groups || [];

  // Case: No groups but directly has stations (flat JSON style)
  if (!groups.length && json.stations && Array.isArray(json.stations)) {
    groups = [{ name: 'วิดีโอทั้งหมด', stations: json.stations }];
  }

  groups.forEach((group) => {
    const gName = group.name || 'ทั่วไป';
    const stations = group.stations || [];
    
    stations.forEach((s) => {
      // Validate that URL exists
      if (s.url && s.url.startsWith('http') && s.url.length > 12) {
        flat.push({
          name:  s.name  || 'ไม่มีชื่อ',
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

  // Remove hero loading state once processed
  const heroSec = $('hero-section');
  if (heroSec) heroSec.classList.remove('loading');

  renderHero(flat);
  renderNavTabs(json);
  renderGroupFilter(groups);
  renderVideos();
}

function extractCode(name) {
  const m = name && name.match(/\b([A-Z0-9]+-\d+)\b/i);
  return m ? m[1].toUpperCase() : '';
}

// ── Hero Banner ────────────────────────────────────────
function renderHero(videos) {
  if (!videos.length) {
    DOM.heroBg.style.backgroundImage = '';
    DOM.heroTitle.textContent = 'ไม่มีข้อมูลวิดีโอ';
    DOM.heroDesc.textContent = 'กรุณาเลือกแหล่งข้อมูลอื่น';
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
  DOM.heroDesc.textContent = pick.group + ' • ' + (pick.code || 'HD Stream');

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
    DOM.heroDesc.textContent = next.group + ' • ' + (next.code || 'HD Stream');
    DOM.heroPlayBtn.onclick = () => openModal(next, state.filteredVideos.indexOf(next));
    DOM.heroInfoBtn.onclick = () => openModal(next, state.filteredVideos.indexOf(next));
  }, 9000);
}

// ── Navbar Header Tabs ─────────────────────────────────
function renderNavTabs(json) {
  const plName = state.playlists[state.playlistIdx].name;
  DOM.navTabs.innerHTML = `
    <button class="nav-tab active" onclick="setActiveGroup('all')">
      ${getIcon('movie')} <span>${escHtml(plName)}</span>
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
      ${getIcon('movie')} <span>ทั้งหมด</span>
    </button>
    ${uniqueGroups.map((g, i) => `
      <button class="filter-chip" id="chip-${i}" onclick="setActiveGroup('${escHtml(g)}')">
        <span>${g}</span>
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

  // Group filter
  if (state.activeGroup !== 'all') {
    videos = videos.filter((v) => v.group === state.activeGroup);
  }

  // Multi-token fuzzy search: every space-separated token must match
  if (state.searchQuery) {
    const tokens = state.searchQuery.trim().split(/\s+/).filter(Boolean);
    videos = videos.filter((v) => {
      const haystack = (v.name + ' ' + (v.code || '') + ' ' + v.group).toLowerCase();
      return tokens.every(token => haystack.includes(token));
    });

    // Relevance sort: exact name match first, then starts-with, then rest
    const q = state.searchQuery.trim();
    videos.sort((a, b) => {
      const aName = a.name.toLowerCase();
      const bName = b.name.toLowerCase();
      const aExact = aName === q ? 0 : aName.startsWith(q) ? 1 : 2;
      const bExact = bName === q ? 0 : bName.startsWith(q) ? 1 : 2;
      return aExact - bExact;
    });
  }

  state.filteredVideos = videos;
  state.page = 0;
  renderVideos();

  // Update clear button visibility
  const clearBtn = document.getElementById('search-clear-btn');
  if (clearBtn) clearBtn.classList.toggle('visible', !!state.searchQuery);
}

function renderVideos() {
  DOM.videoGrid.innerHTML = '';

  const start = state.page * state.pageSize;
  const end   = start + state.pageSize;
  const slice = state.filteredVideos.slice(start, end);

  if (state.filteredVideos.length === 0) {
    const emptyMsg = state.searchQuery
      ? `ไม่พบผลการค้นหาสำหรับ &ldquo;<strong>${escHtml(state.searchQuery)}</strong>&rdquo;`
      : `ไม่พบวิดีโอในหมวดหมู่นี้`;
    DOM.videoGrid.innerHTML = `
      <div class="empty-state">
        ${getIcon('search')}
        <p>${emptyMsg}</p>
        ${state.searchQuery ? `<button class="btn-empty-clear" onclick="clearSearch()">ล้างการค้นหา</button>` : ''}
      </div>`;
    DOM.videoCount.textContent = '';
    renderPagination(0);
    return;
  }

  DOM.videoCount.textContent = `${state.filteredVideos.length} รายการ`;
  if (state.searchQuery) {
    DOM.sectionTitle.textContent = `ผลการค้นหา: "${state.searchQuery}"`;
  } else {
    DOM.sectionTitle.textContent =
      state.activeGroup === 'all' ? 'รายการทั้งหมด' : state.activeGroup;
  }

  slice.forEach((video, i) => {
    const globalIdx = start + i;
    const card = createVideoCard(video, globalIdx);
    DOM.videoGrid.appendChild(card);
  });

  const totalPages = Math.ceil(state.filteredVideos.length / state.pageSize);
  renderPagination(totalPages);
}

function createVideoCard(video, idx) {
  const card = document.createElement('div');
  card.className = 'video-card';
  card.style.animationDelay = `${(idx % state.pageSize) * 20}ms`;

  const thumbSrc = video.image || generatePlaceholder(video.name);
  const extension = video.url.includes('.m3u8') ? 'M3U8' : 'MP4';

  const q = state.searchQuery || '';
  card.innerHTML = `
    <div class="card-thumb">
      <img
        src="${escHtml(thumbSrc)}"
        alt="${escHtml(video.name)}"
        loading="lazy"
        onerror="this.src='data:image/svg+xml,<svg xmlns=%22http://www.w3.org/2000/svg%22 width=%22320%22 height=%22200%22><rect fill=%22%231a1a28%22 width=%22320%22 height=%22200%22/><path fill=%22%23606080%22 transform=%22translate(136, 76) scale(2)%22 d=%22M18 4l2 4h-3l-2-4h-2l2 4h-3l-2-4H8l2 4H7L5 4H4c-1.1 0-1.99.9-1.99 2L2 18c0 1.1.9 2 2 2h16c1.1 0 2-.9 2-2V4h-4z%22/></svg>'"
      />
      <div class="card-play-overlay">
        <div class="card-play-btn">${getIcon('play')}</div>
      </div>
      ${video.code ? `<span class="card-badge">${escHtml(video.code)}</span>` : ''}
      <span class="card-duration">${extension}</span>
    </div>
    <div class="card-body">
      ${video.code ? `<div class="card-code">${highlightText(video.code, q)}</div>` : ''}
      <div class="card-title">${highlightText(video.name, q)}</div>
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
  return `data:image/svg+xml,<svg xmlns="http://www.w3.org/2000/svg" width="320" height="200"><rect fill="%231a1a28" width="320" height="200"/><path fill="%23606080" transform="translate(136, 76) scale(2)" d="M18 4l2 4h-3l-2-4h-2l2 4h-3l-2-4H8l2 4H7L5 4H4c-1.1 0-1.99.9-1.99 2L2 18c0 1.1.9 2 2 2h16c1.1 0 2-.9 2-2V4h-4z"/></svg>`;
}

function renderPagination(totalPages) {
  if (!DOM.paginationWrap) return;
  if (totalPages <= 1) {
    DOM.paginationWrap.innerHTML = '';
    return;
  }

  const currentPage = state.page;
  let html = '';

  // Prev button
  const prevDisabled = currentPage === 0 ? 'disabled' : '';
  html += `<button class="btn-page ${prevDisabled}" onclick="changePage(${currentPage - 1})">${getIcon('navigate_before')}</button>`;

  // Page numbers
  const maxVisible = 5;
  let startPage = Math.max(0, currentPage - 2);
  let endPage = Math.min(totalPages - 1, startPage + maxVisible - 1);
  
  if (endPage - startPage < maxVisible - 1) {
    startPage = Math.max(0, endPage - maxVisible + 1);
  }

  if (startPage > 0) {
    html += `<button class="btn-page" onclick="changePage(0)">1</button>`;
    if (startPage > 1) {
      html += `<span class="btn-page dots">...</span>`;
    }
  }

  for (let i = startPage; i <= endPage; i++) {
    const activeClass = i === currentPage ? 'active' : '';
    html += `<button class="btn-page ${activeClass}" onclick="changePage(${i})">${i + 1}</button>`;
  }

  if (endPage < totalPages - 1) {
    if (endPage < totalPages - 2) {
      html += `<span class="btn-page dots">...</span>`;
    }
    html += `<button class="btn-page" onclick="changePage(${totalPages - 1})">${totalPages}</button>`;
  }

  // Next button
  const nextDisabled = currentPage === totalPages - 1 ? 'disabled' : '';
  html += `<button class="btn-page ${nextDisabled}" onclick="changePage(${currentPage + 1})">${getIcon('navigate_next')}</button>`;

  DOM.paginationWrap.innerHTML = html;
}

function changePage(p) {
  state.page = p;
  renderVideos();
  // Scroll to the top of the video section smoothly
  const sectionHeader = document.querySelector('.section-header');
  if (sectionHeader) {
    sectionHeader.scrollIntoView({ behavior: 'smooth', block: 'start' });
  }
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
let _playerControlsInited = false;
function openModal(video, idx) {
  state.currentVideo = video;
  state.currentIndex = idx >= 0 ? idx : state.filteredVideos.indexOf(video);

  DOM.modalTitle.textContent    = video.name;
  DOM.modalGroupTag.textContent = video.group;
  DOM.modalMetaCode.textContent = video.code ? `รหัสหนัง: ${video.code}` : '';

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

  if (!DOM.modalOverlay.classList.contains('open')) {
    state.lastScrollY = window.scrollY;
  }
  DOM.modalOverlay.classList.add('open');
  document.body.classList.add('modal-open');
  document.body.style.overflow = 'hidden';

  // Initialize player controls only once
  if (!_playerControlsInited) {
    _playerControlsInited = true;
    initPlayerControls();
  }
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
      showToast(getIcon('warning') + ' <span>เบราว์เซอร์ของคุณไม่รองรับการเล่นไฟล์ HLS (.m3u8)</span>');
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
  document.body.classList.remove('modal-open');
  
  if (state.hlsInstance) {
    state.hlsInstance.destroy();
    state.hlsInstance = null;
  }
  
  DOM.videoPlayer.pause();
  DOM.videoPlayer.removeAttribute('src');
  DOM.videoPlayer.load();
  document.body.style.overflow = '';
  window.scrollTo(0, state.lastScrollY);

  // Reset player state
  DOM.videoPlayer.style.filter = '';
  DOM.videoPlayer.playbackRate = 1;
  gs.brightness = 1;
  gs.speedIdx = 3; // back to 1×
  const speedLabel = $('speed-label');
  if (speedLabel) speedLabel.textContent = '1×';

  // Unlock if locked
  if (gs.locked) {
    gs.locked = false;
    const overlay = $('lock-screen-overlay');
    if (overlay) overlay.classList.remove('active');
    const iconLock   = $('icon-lock');
    const iconUnlock = $('icon-unlock');
    if (iconLock)   iconLock.style.display   = 'none';
    if (iconUnlock) iconUnlock.style.display = '';
  }
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
          onerror="this.src='data:image/svg+xml,<svg xmlns=%22http://www.w3.org/2000/svg%22 width=%22160%22 height=%22100%22><rect fill=%22%231a1a28%22 width=%22160%22 height=%22100%22/><path fill=%22%23606080%22 transform=%22translate(68, 38)%22 d=%22M18 4l2 4h-3l-2-4h-2l2 4h-3l-2-4H8l2 4H7L5 4H4c-1.1 0-1.99.9-1.99 2L2 18c0 1.1.9 2 2 2h16c1.1 0 2-.9 2-2V4h-4z%22/></svg>'"
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
    .then(() => showToast(getIcon('check_circle') + ' <span>คัดลอกลิงก์วิดีโอแล้ว</span>'))
    .catch(() => showToast(getIcon('cancel') + ' <span>ไม่สามารถคัดลอกได้</span>'));
}

// ── Toast Notifications ─────────────────────────────────
let toastTimer = null;
function showToast(msg) {
  DOM.toast.innerHTML = msg;
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

// ── Debounce Utility ────────────────────────────────────
function debounce(fn, delay) {
  let timer;
  return function (...args) {
    clearTimeout(timer);
    timer = setTimeout(() => fn.apply(this, args), delay);
  };
}

// ── Highlight matched text ───────────────────────────────
// Wraps matched tokens in <mark class="search-highlight"> spans
function highlightText(text, query) {
  if (!query || !text) return escHtml(text);
  const tokens = query.trim().split(/\s+/).filter(Boolean);
  if (!tokens.length) return escHtml(text);
  // Escape text first, then highlight
  let result = escHtml(text);
  tokens.forEach(token => {
    const safeToken = token.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
    const re = new RegExp(`(${safeToken})`, 'gi');
    result = result.replace(re, '<mark class="search-highlight">$1</mark>');
  });
  return result;
}

// ── Recent Searches (localStorage) ──────────────────────
const RECENT_SEARCH_KEY = 'playidtv_recent_searches';
const RECENT_SEARCH_MAX = 6;

function getRecentSearches() {
  try {
    return JSON.parse(localStorage.getItem(RECENT_SEARCH_KEY) || '[]');
  } catch { return []; }
}

function saveRecentSearch(query) {
  if (!query || query.length < 2) return;
  try {
    let list = getRecentSearches().filter(q => q !== query);
    list.unshift(query);
    list = list.slice(0, RECENT_SEARCH_MAX);
    localStorage.setItem(RECENT_SEARCH_KEY, JSON.stringify(list));
  } catch {}
}

function clearRecentSearches() {
  try { localStorage.removeItem(RECENT_SEARCH_KEY); } catch {}
}

// ═══════════════════════════════════════════════════════
// ── Apple-Style Bottom Tab Bar ─────────────────────────
// ═══════════════════════════════════════════════════════

// Inject drawer and search panel elements once
(function injectTabBarPanels() {
  // Categories drawer
  const drawer = document.createElement('div');
  drawer.className = 'tab-categories-drawer';
  drawer.id = 'tab-categories-drawer';
  drawer.innerHTML = `
    <div class="tab-categories-drawer-handle"></div>
    <div class="tab-categories-drawer-title">เลือกหมวดหมู่</div>
    <div id="tab-categories-list"></div>
  `;
  document.body.appendChild(drawer);

  // Search panel
  const searchPanel = document.createElement('div');
  searchPanel.className = 'tab-search-panel';
  searchPanel.id = 'tab-search-panel';
  searchPanel.innerHTML = `
    <div class="tab-search-panel-row">
      <div class="tab-search-panel-input-wrap">
        <svg viewBox="0 0 24 24" class="tab-search-panel-icon"><path d="M15.5 14h-.79l-.28-.27C15.41 12.59 16 11.11 16 9.5 16 5.91 13.09 3 9.5 3S3 5.91 3 9.5 5.91 16 9.5 16c1.61 0 3.09-.59 4.23-1.57l.27.28v.79l5 4.99L20.49 19l-4.99-5zm-6 0C7.01 14 5 11.99 5 9.5S7.01 5 9.5 5 14 7.01 14 9.5 11.99 14 9.5 14z"/></svg>
        <input
          type="search"
          id="tab-search-input"
          class="tab-search-panel-input"
          placeholder="ค้นหาวิดีโอ..."
          autocomplete="off"
          autocorrect="off"
          enterkeyhint="search"
        />
      </div>
      <button class="tab-search-panel-close" id="tab-search-close-btn" aria-label="ปิดค้นหา">
        <svg class="tab-bar-icon" viewBox="0 0 24 24" style="width:18px;height:18px;">
          <path d="M19 6.41L17.59 5 12 10.59 6.41 5 5 6.41 10.59 12 5 17.59 6.41 19 12 13.41 17.59 19 19 17.59 13.41 12z"/>
        </svg>
      </button>
    </div>
    <div id="tab-search-suggestions" class="search-suggestions"></div>
  `;
  document.body.appendChild(searchPanel);

  // Backdrop (shared by drawer & search panel)
  const backdrop = document.createElement('div');
  backdrop.className = 'tab-drawer-backdrop';
  backdrop.id = 'tab-drawer-backdrop';
  backdrop.addEventListener('click', closeTabOverlays);
  document.body.appendChild(backdrop);

  // Wire search tab input → main search logic (with debounce)
  const tabSearchInput = document.getElementById('tab-search-input');
  const suggestionBox  = document.getElementById('tab-search-suggestions');

  function renderSearchSuggestions(query) {
    if (!suggestionBox) return;
    const recents = getRecentSearches();
    if (!query && recents.length === 0) {
      suggestionBox.innerHTML = '';
      suggestionBox.classList.remove('visible');
      return;
    }

    if (query) {
      // Show filtered recents that contain the query
      const matches = recents.filter(r => r.toLowerCase().includes(query.toLowerCase()) && r.toLowerCase() !== query.toLowerCase());
      if (matches.length === 0) {
        suggestionBox.innerHTML = '';
        suggestionBox.classList.remove('visible');
        return;
      }
      suggestionBox.innerHTML = `
        <div class="search-recent-label">ค้นหาล่าสุด</div>
        ${matches.map(r => `
          <div class="search-suggestion-chip" onclick="applyMobileSearch('${escHtml(r)}')">
            <svg class="tab-bar-icon" viewBox="0 0 24 24" style="width:14px;height:14px;flex-shrink:0;opacity:0.6"><path d="M13 3c-4.97 0-9 4.03-9 9H1l3.89 3.89.07.14L9 12H6c0-3.87 3.13-7 7-7s7 3.13 7 7-3.13 7-7 7c-1.93 0-3.68-.79-4.95-2.05L6.64 18.36C8.28 19.99 10.53 21 13 21c4.97 0 9-4.03 9-9s-4.03-9-9-9z"/></svg>
            <span>${escHtml(r)}</span>
          </div>
        `).join('')}
      `;
    } else {
      // Show all recents when query is empty
      suggestionBox.innerHTML = `
        <div class="search-recent-label">
          ค้นหาล่าสุด
          <button class="search-recent-clear" onclick="clearRecentSearches(); renderSearchSuggestions('')">ล้าง</button>
        </div>
        ${recents.map(r => `
          <div class="search-suggestion-chip" onclick="applyMobileSearch('${escHtml(r)}')">
            <svg class="tab-bar-icon" viewBox="0 0 24 24" style="width:14px;height:14px;flex-shrink:0;opacity:0.6"><path d="M13 3c-4.97 0-9 4.03-9 9H1l3.89 3.89.07.14L9 12H6c0-3.87 3.13-7 7-7s7 3.13 7 7-3.13 7-7 7c-1.93 0-3.68-.79-4.95-2.05L6.64 18.36C8.28 19.99 10.53 21 13 21c4.97 0 9-4.03 9-9s-4.03-9-9-9z"/></svg>
            <span>${escHtml(r)}</span>
          </div>
        `).join('')}
      `;
    }
    suggestionBox.classList.add('visible');
  }

  const debouncedTabSearch = debounce((value) => {
    state.searchQuery = value.trim().toLowerCase();
    if (state.searchQuery) saveRecentSearch(state.searchQuery);
    // Keep desktop search bar in sync
    if (DOM.searchInput) DOM.searchInput.value = value;
    const clearBtn = document.getElementById('search-clear-btn');
    if (clearBtn) clearBtn.classList.toggle('visible', value.length > 0);
    applyFilter();
    renderSearchSuggestions(value.trim().toLowerCase());
  }, 200);

  if (tabSearchInput) {
    tabSearchInput.addEventListener('input', (e) => {
      debouncedTabSearch(e.target.value);
      renderSearchSuggestions(e.target.value.trim().toLowerCase());
    });
    tabSearchInput.addEventListener('focus', () => {
      renderSearchSuggestions(tabSearchInput.value.trim().toLowerCase());
    });
  }

  // Close button
  const closeBtn = document.getElementById('tab-search-close-btn');
  if (closeBtn) {
    closeBtn.addEventListener('click', () => {
      closeTabOverlays();
      setTabActive('home');
    });
  }
})();

/** Apply a search query from mobile suggestion chip */
function applyMobileSearch(query) {
  const tabInput = document.getElementById('tab-search-input');
  if (tabInput) tabInput.value = query;
  if (DOM.searchInput) DOM.searchInput.value = query;
  state.searchQuery = query.toLowerCase();
  saveRecentSearch(query);
  const clearBtn = document.getElementById('search-clear-btn');
  if (clearBtn) clearBtn.classList.toggle('visible', query.length > 0);
  applyFilter();
  // Close overlay to see results
  closeTabOverlays();
  setTabActive('home');
}

/** Clear search everywhere */
function clearSearch() {
  state.searchQuery = '';
  if (DOM.searchInput) { DOM.searchInput.value = ''; }
  const tabInput = document.getElementById('tab-search-input');
  if (tabInput) tabInput.value = '';
  const clearBtn = document.getElementById('search-clear-btn');
  if (clearBtn) clearBtn.classList.remove('visible');
  applyFilter();
}

/** Populate the categories drawer list from current groups */
function renderTabCategories() {
  const list = document.getElementById('tab-categories-list');
  if (!list || !state.data) return;

  const groups = (state.data.groups || []).filter(
    g => g.stations && g.stations.length > 0
  );

  let html = `
    <div class="tab-category-row ${state.activeGroup === 'all' ? 'active' : ''}" onclick="tabSelectCategory('all')">
      <svg style="width:18px;height:18px;fill:currentColor;flex-shrink:0" viewBox="0 0 24 24">
        <path d="M18 4l2 4h-3l-2-4h-2l2 4h-3l-2-4H8l2 4H7L5 4H4c-1.1 0-1.99.9-1.99 2L2 18c0 1.1.9 2 2 2h16c1.1 0 2-.9 2-2V4h-4z"/>
      </svg>
      <span>ทั้งหมด</span>
      <span class="tab-category-count">${state.allVideos.length}</span>
      <svg class="tab-cat-check" style="width:18px;height:18px;fill:currentColor;" viewBox="0 0 24 24">
        <path d="M9 16.17L4.83 12l-1.42 1.41L9 19 21 7l-1.41-1.41z"/>
      </svg>
    </div>
  `;

  groups.forEach(g => {
    const isActive = state.activeGroup === g.name;
    const count = g.stations.length;
    html += `
      <div class="tab-category-row ${isActive ? 'active' : ''}" onclick="tabSelectCategory('${escHtml(g.name)}')">
        <svg style="width:18px;height:18px;fill:currentColor;flex-shrink:0" viewBox="0 0 24 24">
          <path d="M10 4H4c-1.1 0-1.99.9-1.99 2L2 18c0 1.1.9 2 2 2h16c1.1 0 2-.9 2-2V8c0-1.1-.9-2-2-2h-8l-2-2z"/>
        </svg>
        <span>${escHtml(g.name)}</span>
        <span class="tab-category-count">${count}</span>
        <svg class="tab-cat-check" style="width:18px;height:18px;fill:currentColor;" viewBox="0 0 24 24">
          <path d="M9 16.17L4.83 12l-1.42 1.41L9 19 21 7l-1.41-1.41z"/>
        </svg>
      </div>
    `;
  });

  list.innerHTML = html;
}

/** Select a category from the drawer and close it */
function tabSelectCategory(group) {
  setActiveGroup(group);
  closeTabOverlays();
  setTabActive('home');
  // Scroll to video grid
  const sectionHeader = document.querySelector('.section-header');
  if (sectionHeader) {
    setTimeout(() => sectionHeader.scrollIntoView({ behavior: 'smooth', block: 'start' }), 100);
  }
}

/** Close all tab bar overlays (drawer + search panel + backdrop) */
function closeTabOverlays() {
  const drawer   = document.getElementById('tab-categories-drawer');
  const panel    = document.getElementById('tab-search-panel');
  const backdrop = document.getElementById('tab-drawer-backdrop');
  if (drawer)   drawer.classList.remove('open');
  if (panel)    panel.classList.remove('open');
  if (backdrop) backdrop.classList.remove('open');
}

/** Set active tab item visually */
function setTabActive(tabId) {
  document.querySelectorAll('.tab-bar-item').forEach(el => {
    const active = el.id === `tab-${tabId}`;
    el.classList.toggle('active', active);
    el.setAttribute('aria-selected', active ? 'true' : 'false');
  });
}

/** Main tab switcher — called by onclick on each tab button */
function switchTab(tabId) {
  const drawer   = document.getElementById('tab-categories-drawer');
  const panel    = document.getElementById('tab-search-panel');
  const backdrop = document.getElementById('tab-drawer-backdrop');
  const tabInput = document.getElementById('tab-search-input');

  // Close any open overlay first (toggle behavior)
  const drawerOpen = drawer && drawer.classList.contains('open');
  const panelOpen  = panel  && panel.classList.contains('open');

  switch (tabId) {

    case 'home':
      closeTabOverlays();
      setTabActive('home');
      // Reset search and scroll to top
      state.searchQuery = '';
      if (DOM.searchInput) DOM.searchInput.value = '';
      if (tabInput) tabInput.value = '';
      const clearBtnHome = document.getElementById('search-clear-btn');
      if (clearBtnHome) clearBtnHome.classList.remove('visible');
      applyFilter();
      window.scrollTo({ top: 0, behavior: 'smooth' });
      break;

    case 'categories':
      if (drawerOpen) {
        // Toggle off
        closeTabOverlays();
        setTabActive('home');
      } else {
        closeTabOverlays();
        setTabActive('categories');
        renderTabCategories();
        if (drawer)   drawer.classList.add('open');
        if (backdrop) backdrop.classList.add('open');
      }
      break;

    case 'search':
      if (panelOpen) {
        // Toggle off
        closeTabOverlays();
        setTabActive('home');
      } else {
        closeTabOverlays();
        setTabActive('search');
        if (panel)    panel.classList.add('open');
        if (backdrop) backdrop.classList.add('open');
        // Auto-focus the search input
        setTimeout(() => {
          if (tabInput) tabInput.focus();
        }, 120);
      }
      break;

    case 'sources':
      closeTabOverlays();
      setTabActive('home'); // source modal is separate, reset tab
      openSourceModal();
      break;

    default:
      break;
  }
}
