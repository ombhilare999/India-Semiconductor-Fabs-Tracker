/* India SemiFab Tracker — app.js */

const STATUS_COLORS = {
  producing:    { fill: '#22d45e', glow: 'rgba(34,212,94,0.6)',   label: 'Producing' },
  construction: { fill: '#f5a623', glow: 'rgba(245,166,35,0.6)',  label: 'Under Construction' },
  planned:      { fill: '#4f8ef7', glow: 'rgba(79,142,247,0.6)',  label: 'Planned' },
};

const TILES = {
  dark:  'https://{s}.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}{r}.png',
  light: 'https://{s}.basemaps.cartocdn.com/light_all/{z}/{x}/{y}{r}.png',
};

const TILE_ATTR = '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> &copy; <a href="https://carto.com/attributions">CARTO</a>';

let map;
let tileLayer;
let newsData = {};
let clusterGroup;

// ── Theme ──────────────────────────────────────────────────
function getTheme() {
  return localStorage.getItem('semifab-theme') || 'light';
}

function applyTheme(theme) {
  document.documentElement.setAttribute('data-theme', theme);
  document.getElementById('themeIcon').textContent = theme === 'dark' ? '☀' : '☾';
  localStorage.setItem('semifab-theme', theme);

  if (tileLayer && map) {
    map.removeLayer(tileLayer);
    tileLayer = L.tileLayer(TILES[theme], {
      attribution: TILE_ATTR,
      subdomains: 'abcd',
      maxZoom: 19,
    }).addTo(map);
  }
}

function toggleTheme() {
  const current = getTheme();
  applyTheme(current === 'dark' ? 'light' : 'dark');
}

// ── Map init ───────────────────────────────────────────────
function initMap() {
  map = L.map('map', {
    center: [22, 80],
    zoom: 5,
    minZoom: 4,
    maxZoom: 10,
    zoomControl: true,
    attributionControl: true,
    maxBounds: [[5, 60], [40, 102]],
    maxBoundsViscosity: 0.85,
  });

  const theme = getTheme();
  tileLayer = L.tileLayer(TILES[theme], {
    attribution: TILE_ATTR,
    subdomains: 'abcd',
    maxZoom: 19,
  }).addTo(map);

  clusterGroup = L.markerClusterGroup({
    maxClusterRadius: 48,
    showCoverageOnHover: false,
    zoomToBoundsOnClick: true,
    spiderfyOnMaxZoom: true,
    spiderfyDistanceMultiplier: 1.8,
    iconCreateFunction(cluster) {
      const count = cluster.getChildCount();
      const svg = `
        <svg xmlns="http://www.w3.org/2000/svg" width="48" height="48" viewBox="0 0 48 48">
          <defs>
            <filter id="cglow">
              <feGaussianBlur stdDeviation="3" result="blur"/>
              <feMerge><feMergeNode in="blur"/><feMergeNode in="SourceGraphic"/></feMerge>
            </filter>
          </defs>
          <circle cx="24" cy="24" r="20" fill="rgba(0,212,255,0.12)" stroke="#00d4ff" stroke-width="1.5" filter="url(#cglow)"/>
          <circle cx="24" cy="24" r="13" fill="rgba(0,212,255,0.08)" stroke="#00d4ff" stroke-width="0.5"/>
          <text x="24" y="29" text-anchor="middle" fill="#00d4ff"
                font-size="14" font-family="Orbitron,monospace" font-weight="700">${count}</text>
        </svg>`.trim();
      return L.divIcon({ html: svg, className: '', iconSize: [48, 48], iconAnchor: [24, 24] });
    },
  });
  map.addLayer(clusterGroup);
}

// ── Marker ────────────────────────────────────────────────
function buildMarker(fab) {
  const c = STATUS_COLORS[fab.status] || STATUS_COLORS.planned;

  const ringAnim = fab.status === 'producing'
    ? `<circle class="marker-ring" cx="20" cy="20" r="10" fill="none" stroke="${c.fill}" stroke-width="2"/>`
    : '';

  const svg = `
    <svg xmlns="http://www.w3.org/2000/svg" width="40" height="40" viewBox="0 0 40 40">
      <defs>
        <filter id="glow-${fab.id}">
          <feGaussianBlur stdDeviation="2.5" result="blur"/>
          <feMerge><feMergeNode in="blur"/><feMergeNode in="SourceGraphic"/></feMerge>
        </filter>
      </defs>
      ${ringAnim}
      <circle cx="20" cy="20" r="10" fill="${c.fill}" filter="url(#glow-${fab.id})" opacity="0.92"/>
      <circle cx="20" cy="20" r="5"  fill="rgba(5,11,20,0.55)"/>
      <circle cx="20" cy="20" r="2.5" fill="${c.fill}"/>
    </svg>`.trim();

  const icon = L.divIcon({
    html: svg,
    className: '',
    iconSize: [40, 40],
    iconAnchor: [20, 20],
    tooltipAnchor: [14, 0],
  });

  const marker = L.marker([fab.lat, fab.lng], { icon });

  const tooltipHtml = `
    <div class="tooltip-name">${fab.name}</div>
    <div class="tooltip-loc">${fab.city}, ${fab.state}</div>
    <div class="tooltip-node">${fab.techNode}</div>`;

  marker.bindTooltip(tooltipHtml, {
    className: 'fab-tooltip',
    direction: 'right',
    offset: [6, 0],
    permanent: false,
  });

  marker.on('click', () => showDetail(fab));

  return marker;
}

// ── Detail panel ──────────────────────────────────────────
function showDetail(fab) {
  const c = STATUS_COLORS[fab.status] || STATUS_COLORS.planned;

  document.getElementById('detailPlaceholder').style.display = 'none';
  document.getElementById('detailContent').style.display = 'block';

  const badge = document.getElementById('dStatus');
  badge.textContent = c.label;
  badge.className = `status-badge ${fab.status}`;

  document.getElementById('dName').textContent        = fab.name;
  document.getElementById('dLocation').textContent    = `${fab.city}, ${fab.state}`;
  document.getElementById('dOperator').textContent    = fab.operator;
  document.getElementById('dTechNode').textContent    = fab.techNode;
  document.getElementById('dChipTypes').textContent   = fab.chipTypes.join(', ');
  document.getElementById('dEndMarkets').textContent  = fab.endMarkets.join(', ');
  document.getElementById('dInvestment').textContent  = fab.investment;
  document.getElementById('dBrief').textContent       = fab.brief;

  renderNews(fab.id);

  if (window.innerWidth <= 768) {
    document.getElementById('detailPanel').classList.add('mobile-open');
  }
}

function closePanel() {
  const panel = document.getElementById('detailPanel');
  panel.style.transform = '';          // clear any inline swipe offset
  panel.classList.remove('mobile-open');
  document.getElementById('detailContent').style.display = 'none';
  document.getElementById('detailPlaceholder').style.display = 'flex';
}

function initMobileGestures() {
  const panel = document.getElementById('detailPanel');
  let startY = 0;
  let lastY  = 0;

  panel.addEventListener('touchstart', e => {
    startY = e.touches[0].clientY;
    lastY  = startY;
    panel.style.transition = 'none';
  }, { passive: true });

  panel.addEventListener('touchmove', e => {
    lastY = e.touches[0].clientY;
    const delta = Math.max(0, lastY - startY); // only follow downward
    panel.style.transform = `translateY(${delta}px)`;
  }, { passive: true });

  panel.addEventListener('touchend', () => {
    panel.style.transition = '';
    if (lastY - startY > 80) {
      closePanel();
    } else {
      panel.style.transform = ''; // snap back
    }
  });

  // Tap on the map background closes the sheet
  map.on('click', () => {
    if (panel.classList.contains('mobile-open')) closePanel();
  });
}

// ── Stats ─────────────────────────────────────────────────
function updateStats(fabs) {
  const counts = { producing: 0, construction: 0, planned: 0 };
  const states = new Set();

  fabs.forEach(f => {
    if (counts[f.status] !== undefined) counts[f.status]++;
    states.add(f.state);
  });

  document.getElementById('countProducing').textContent    = counts.producing;
  document.getElementById('countConstruction').textContent = counts.construction;
  document.getElementById('countPlanned').textContent      = counts.planned;
  document.getElementById('statTotal').textContent         = fabs.length;
  document.getElementById('statStates').textContent        = states.size;
  document.getElementById('statInvestment').textContent    = '~$18B+';
  document.getElementById('totalCount').textContent        = fabs.length;
}

// ── News helpers ───────────────────────────────────────────
function relativeTime(dateStr) {
  if (!dateStr) return '';
  const diff = Date.now() - new Date(dateStr).getTime();
  const days = Math.floor(diff / 86400000);
  if (days === 0) return 'today';
  if (days === 1) return '1 day ago';
  if (days < 7)  return `${days} days ago`;
  if (days < 30) return `${Math.floor(days / 7)} week${Math.floor(days / 7) > 1 ? 's' : ''} ago`;
  return `${Math.floor(days / 30)} month${Math.floor(days / 30) > 1 ? 's' : ''} ago`;
}

function renderNews(fabId) {
  const section  = document.getElementById('newsSection');
  const list     = document.getElementById('newsList');
  const fetched  = document.getElementById('newsFetched');
  const items    = newsData[String(fabId)];

  if (!items || items.length === 0) {
    section.style.display = 'none';
    return;
  }

  section.style.display = 'block';

  const fetchedAt = newsData._meta?.fetchedAt;
  fetched.textContent = fetchedAt ? `updated ${relativeTime(fetchedAt)}` : '';

  list.innerHTML = items.map(item => `
    <a class="news-item" href="${item.link}" target="_blank" rel="noopener noreferrer">
      <div class="news-item-title">${item.title}</div>
      <div class="news-item-meta">
        <span class="news-source">${item.source || 'News'}</span>
        <span class="news-date">${relativeTime(item.published)}</span>
      </div>
    </a>
  `).join('');
}

// ── Load data ─────────────────────────────────────────────
async function loadFabs() {
  const t = Date.now(); // cache-bust both files every page load

  const [fabsRes, newsRes] = await Promise.all([
    fetch(`data/fabs.json?t=${t}`),
    fetch(`data/news.json?t=${t}`),
  ]);

  const t0   = performance.now();
  const data = await fabsRes.json();
  newsData   = await newsRes.json();
  const fabs = data.fabs;

  const ms = Math.round(performance.now() - t0);
  document.getElementById('loadTime').textContent =
    `Live · ${fabs.length} facilities · ${ms}ms`;

  if (data.lastUpdated) {
    const d = new Date(data.lastUpdated);
    document.getElementById('lastUpdated').textContent =
      d.toLocaleDateString('en-IN', { day: 'numeric', month: 'long', year: 'numeric' });
  }

  updateStats(fabs);
  fabs.forEach(fab => clusterGroup.addLayer(buildMarker(fab)));
}

// ── Boot ──────────────────────────────────────────────────
document.addEventListener('DOMContentLoaded', () => {
  // Apply saved theme before map init so correct tiles load first
  applyTheme(getTheme());
  initMap();
  initMobileGestures();

  loadFabs().catch(err => {
    console.error('Tracker: failed to load fabs data:', err);
    document.getElementById('loadTime').textContent = 'Error loading tracker data';
  });
});
