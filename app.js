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
let allFabs = [];
let markersByFab = {};
let currentView = 'map';
let ismNotifications = [];

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
  document.getElementById('dCapacity').textContent    = fab.capacity || '—';
  document.getElementById('dInvestment').textContent  = fab.investment;
  document.getElementById('dBrief').textContent       = fab.brief;

  // Links
  const linksEl = document.getElementById('dLinks');
  const newsUrl = `https://news.google.com/search?q=${encodeURIComponent(fab.newsQuery)}&hl=en-IN&gl=IN&ceid=IN:en`;
  let linksHtml = `<a class="d-link-btn primary" href="${newsUrl}" target="_blank" rel="noopener noreferrer">Google News</a>`;
  if (fab.links && fab.links.company) {
    linksHtml += `<a class="d-link-btn" href="${fab.links.company}" target="_blank" rel="noopener noreferrer">Company Site</a>`;
  }
  linksEl.innerHTML = linksHtml;

  renderNews(fab.id);

  if (window.innerWidth <= 768) {
    document.getElementById('detailPanel').classList.add('mobile-open');
  }
}

function closePanel() {
  const panel = document.getElementById('detailPanel');
  panel.style.transform = '';
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
    const delta = Math.max(0, lastY - startY);
    panel.style.transform = `translateY(${delta}px)`;
  }, { passive: true });

  panel.addEventListener('touchend', () => {
    panel.style.transition = '';
    if (lastY - startY > 80) {
      closePanel();
    } else {
      panel.style.transform = '';
    }
  });

  map.on('click', () => {
    if (panel.classList.contains('mobile-open')) closePanel();
  });
}

// ── Investment helper ─────────────────────────────────────
function computeInvestment(fabs) {
  const totalM = fabs.reduce((s, f) => s + (f.investmentUSD || 0), 0);
  if (totalM === 0) return 'N/A';
  if (totalM >= 1000) {
    const b = (totalM / 1000).toFixed(1).replace(/\.0$/, '');
    return `~$${b}B+`;
  }
  return `~$${totalM}M+`;
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

// ── ISM feed ──────────────────────────────────────────────
function renderIsmFeed() {
  const feed = document.getElementById('ismFeed');
  if (!feed) return;

  const items = ismNotifications.slice(0, 5);
  if (items.length === 0) {
    feed.innerHTML = '';
    return;
  }

  feed.innerHTML =
    `<div class="ism-feed-title">ISM NOTIFICATIONS</div>` +
    items.map(n => {
      const typeLabel = n.type === 'press-release' ? 'PRESS RELEASE' : 'NOTIFICATION';
      const inner = `
        <div class="ism-item-type">${typeLabel}</div>
        <div class="ism-item-title">${n.title.length > 90 ? n.title.slice(0, 88) + '…' : n.title}</div>
        <div class="ism-item-date">${n.date || ''}</div>`;
      return n.pdfUrl
        ? `<a class="ism-item" href="${n.pdfUrl}" target="_blank" rel="noopener noreferrer">${inner}</a>`
        : `<div class="ism-item">${inner}</div>`;
    }).join('');
}

// ── Timeline ──────────────────────────────────────────────
const TL_CATEGORIES = [
  { key: 'wafer-fab',          label: 'WAFER FAB' },
  { key: 'osat',               label: 'OSAT / PACKAGING' },
  { key: 'compound-fab',       label: 'COMPOUND SEMI' },
  { key: 'advanced-packaging', label: 'ADVANCED PACKAGING' },
  { key: 'discrete-power',     label: 'DISCRETE POWER' },
];

function renderTimeline(fabs) {
  const YEAR_START = 1982;
  const YEAR_END   = 2030;
  const PX_PER_YR  = 20;
  const LEFT_W     = 172;
  const RIGHT_PAD  = 32;
  const ROW_H      = 40;
  const CAT_H      = 28;
  const AXIS_H     = 40;
  const DOT_R      = 7;
  const TODAY      = new Date().getFullYear();

  const yearToX = y => LEFT_W + (y - YEAR_START) * PX_PER_YR;
  const svgW    = LEFT_W + (YEAR_END - YEAR_START) * PX_PER_YR + RIGHT_PAD;

  // Calculate height
  let svgH = AXIS_H;
  TL_CATEGORIES.forEach(cat => {
    const n = fabs.filter(f => f.category === cat.key).length;
    if (n > 0) svgH += CAT_H + n * ROW_H;
  });
  svgH += 16;

  const ns = 'http://www.w3.org/2000/svg';
  const svg = document.getElementById('timelineSvg');
  svg.setAttribute('width', svgW);
  svg.setAttribute('height', svgH);
  svg.innerHTML = '';

  function el(tag, attrs) {
    const e = document.createElementNS(ns, tag);
    Object.entries(attrs).forEach(([k, v]) => e.setAttribute(k, v));
    return e;
  }

  // Year grid lines + axis labels
  for (let y = YEAR_START; y <= YEAR_END; y += 4) {
    const x = yearToX(y);
    svg.appendChild(el('line', { x1: x, y1: AXIS_H - 4, x2: x, y2: svgH - 16, class: 'tl-grid-line' }));
    svg.appendChild(Object.assign(el('text', { x, y: AXIS_H - 10, 'text-anchor': 'middle', class: 'tl-axis-label' }), { textContent: y }));
  }

  // NOW line
  const nowX = yearToX(TODAY);
  svg.appendChild(el('line', { x1: nowX, y1: 4, x2: nowX, y2: svgH - 16, class: 'tl-now-line' }));
  svg.appendChild(Object.assign(el('text', { x: nowX + 4, y: 14, class: 'tl-now-label' }), { textContent: 'NOW' }));

  // Category rows
  let curY = AXIS_H;
  TL_CATEGORIES.forEach(cat => {
    const catFabs = fabs.filter(f => f.category === cat.key);
    if (catFabs.length === 0) return;

    // Category header band
    svg.appendChild(el('rect', { x: 0, y: curY, width: svgW, height: CAT_H, class: 'tl-cat-bg' }));
    svg.appendChild(Object.assign(el('text', { x: 10, y: curY + CAT_H / 2 + 4, class: 'tl-cat-label' }), { textContent: cat.label }));
    curY += CAT_H;

    catFabs.forEach(fab => {
      const rowY = curY;
      const cy   = rowY + ROW_H / 2;
      const mx   = yearToX(fab.milestoneYear);

      // Clickable hover rect (full row)
      const hover = el('rect', { x: LEFT_W, y: rowY, width: svgW - LEFT_W, height: ROW_H, class: 'tl-row-hover' });
      hover.addEventListener('click', () => showDetail(fab));
      svg.appendChild(hover);

      // Operational bar from milestone → today
      if (fab.status === 'producing') {
        const bx = yearToX(fab.milestoneYear);
        const ex = yearToX(Math.min(TODAY, YEAR_END));
        svg.appendChild(el('rect', { x: bx, y: cy - 3, width: Math.max(0, ex - bx), height: 6, rx: 3, class: 'tl-bar-producing' }));
      }

      // Dot
      const dot = el('circle', { cx: mx, cy, r: DOT_R, class: `tl-dot tl-dot-${fab.status}` });
      dot.addEventListener('click', () => showDetail(fab));
      svg.appendChild(dot);

      // Fab name label
      const shortName = fab.name.length > 26 ? fab.name.slice(0, 25) + '…' : fab.name;
      const label = Object.assign(el('text', { x: LEFT_W - 10, y: cy + 4, 'text-anchor': 'end', class: 'tl-fab-label' }), { textContent: shortName });
      label.addEventListener('click', () => showDetail(fab));
      svg.appendChild(label);

      // Year tag
      svg.appendChild(Object.assign(el('text', { x: mx + DOT_R + 4, y: cy + 4, class: 'tl-year-tag' }), { textContent: fab.milestoneYear }));

      curY += ROW_H;
    });
  });
}

function toggleView() {
  currentView = currentView === 'map' ? 'timeline' : 'map';
  const isTimeline = currentView === 'timeline';
  const mapWrap = document.getElementById('mapWrap');
  const tlView  = document.getElementById('timelineView');
  const btn     = document.getElementById('viewToggleBtn');

  mapWrap.style.display = isTimeline ? 'none' : '';
  tlView.classList.toggle('active', isTimeline);
  btn.classList.toggle('active', isTimeline);
  btn.textContent = isTimeline ? 'MAP' : 'TIMELINE';

  if (isTimeline) {
    const activeTab = document.querySelector('.filter-tab.active');
    const cat = activeTab ? activeTab.dataset.category : 'all';
    const visible = cat === 'all' ? allFabs : allFabs.filter(f => f.category === cat);
    renderTimeline(visible);
  }
}

// ── Filter tabs ───────────────────────────────────────────
function filterMarkers(category) {
  const visible = category === 'all'
    ? allFabs
    : allFabs.filter(f => f.category === category);

  // Update map markers
  clusterGroup.clearLayers();
  visible.forEach(fab => clusterGroup.addLayer(markersByFab[fab.id]));

  // Update investment stat dynamically
  document.getElementById('statInvestment').textContent = computeInvestment(visible);

  // Re-render timeline if it's the active view
  if (currentView === 'timeline') renderTimeline(visible);
}

function initFilterTabs() {
  document.querySelectorAll('.filter-tab').forEach(tab => {
    tab.addEventListener('click', () => {
      document.querySelectorAll('.filter-tab').forEach(t => t.classList.remove('active'));
      tab.classList.add('active');
      filterMarkers(tab.dataset.category);
    });
  });

  document.getElementById('viewToggleBtn').addEventListener('click', toggleView);
}

// ── Load data ─────────────────────────────────────────────
async function loadFabs() {
  const t = Date.now();

  const [fabsRes, newsRes, ismRes] = await Promise.all([
    fetch(`data/fabs.json?t=${t}`),
    fetch(`data/news.json?t=${t}`),
    fetch(`data/ism_notifications.json?t=${t}`).catch(() => null),
  ]);

  const t0   = performance.now();
  const data = await fabsRes.json();
  newsData   = await newsRes.json();

  if (ismRes) {
    const ismData = await ismRes.json().catch(() => ({ notifications: [] }));
    ismNotifications = ismData.notifications || [];
  }

  const fabs = data.fabs;
  const ms   = Math.round(performance.now() - t0);

  document.getElementById('loadTime').textContent =
    `Live · ${fabs.length} facilities · ${ms}ms`;

  if (data.lastUpdated) {
    const d = new Date(data.lastUpdated);
    document.getElementById('lastUpdated').textContent =
      d.toLocaleDateString('en-IN', { day: 'numeric', month: 'long', year: 'numeric' });
  }

  allFabs = fabs;
  fabs.forEach(fab => {
    const marker = buildMarker(fab);
    markersByFab[fab.id] = marker;
    clusterGroup.addLayer(marker);
  });

  updateStats(fabs);
  filterMarkers('all'); // sets statInvestment for initial 'all' state
  renderIsmFeed();
  initFilterTabs();
}

// ── Boot ──────────────────────────────────────────────────
document.addEventListener('DOMContentLoaded', () => {
  applyTheme(getTheme());
  initMap();
  initMobileGestures();

  loadFabs().catch(err => {
    console.error('Tracker: failed to load fabs data:', err);
    document.getElementById('loadTime').textContent = 'Error loading tracker data';
  });
});
