// ============================================================================
// FOLIUM — Shared utilities
// ============================================================================

function showToast(message, duration = 2600) {
  let toast = document.getElementById('globalToast');
  if (!toast) {
    toast = document.createElement('div');
    toast.id = 'globalToast';
    toast.className = 'toast';
    document.body.appendChild(toast);
  }
  toast.textContent = message;
  toast.classList.add('show');
  clearTimeout(toast._t);
  toast._t = setTimeout(() => toast.classList.remove('show'), duration);
}

function timeAgo(date) {
  if (!date) return '';
  const seconds = Math.floor((Date.now() - date.getTime()) / 1000);
  const map = [
    [31536000, 'y'], [2592000, 'mo'], [86400, 'd'], [3600, 'h'], [60, 'm']
  ];
  for (const [secs, label] of map) {
    const val = Math.floor(seconds / secs);
    if (val >= 1) return `${val}${label} ago`;
  }
  return 'just now';
}

function formatDate(date) {
  if (!date) return '';
  return date.toLocaleDateString('en-US', { month: 'long', day: 'numeric', year: 'numeric' });
}

function initials(name) {
  if (!name) return '?';
  return name.trim().split(/\s+/).slice(0, 2).map(w => w[0].toUpperCase()).join('');
}

function escapeHtml(str) {
  const div = document.createElement('div');
  div.textContent = str || '';
  return div.innerHTML;
}

function readingTime(html) {
  const text = (html || '').replace(/<[^>]*>/g, ' ');
  const words = text.trim().split(/\s+/).filter(Boolean).length;
  return Math.max(1, Math.round(words / 200));
}

function excerptFromHtml(html, len = 160) {
  const text = (html || '').replace(/<[^>]*>/g, ' ').replace(/\s+/g, ' ').trim();
  return text.length > len ? text.slice(0, len).trim() + '…' : text;
}

function slugify(str) {
  return (str || 'untitled')
    .toLowerCase().trim()
    .replace(/[^\w\s-]/g, '')
    .replace(/\s+/g, '-')
    .slice(0, 60);
}

function debounce(fn, wait = 300) {
  let t;
  return (...args) => { clearTimeout(t); t = setTimeout(() => fn(...args), wait); };
}

async function shareOrCopy(url, title) {
  if (navigator.share) {
    try { await navigator.share({ title, url }); return; }
    catch (e) { /* user cancelled */ return; }
  }
  await navigator.clipboard.writeText(url);
  showToast('Link copied to clipboard');
}

// Renders an <img> or a lettered avatar div into the given container html string
function avatarHtml(user, sizeClass = '') {
  const cls = `avatar ${sizeClass}`.trim();
  if (user && user.photoURL) {
    return `<img class="${cls}" src="${user.photoURL}" alt="${escapeHtml(user.name || '')}">`;
  }
  return `<div class="${cls}">${initials(user && user.name)}</div>`;
}

// Redirect helpers shared by pages that require an authenticated session
function requireAuth(onReady) {
  auth.onAuthStateChanged(user => {
    if (!user) { window.location.href = 'auth.html'; return; }
    onReady(user);
  });
}

function currentUserDoc(uid) {
  return db.collection('users').doc(uid).get().then(d => d.exists ? { uid, ...d.data() } : null);
}

// Registers the service worker for PWA install/offline support
function registerServiceWorker() {
  if ('serviceWorker' in navigator) {
    window.addEventListener('load', () => {
      navigator.serviceWorker.register('/sw.js').catch(err => console.warn('SW registration failed', err));
    });
  }
}
registerServiceWorker();

// Basic "Add to home screen" prompt wiring (Android/Chrome)
let deferredInstallPrompt = null;
window.addEventListener('beforeinstallprompt', (e) => {
  e.preventDefault();
  deferredInstallPrompt = e;
  const btn = document.getElementById('installBtn');
  if (btn) btn.classList.remove('hidden');
});
function triggerInstall() {
  if (!deferredInstallPrompt) return;
  deferredInstallPrompt.prompt();
  deferredInstallPrompt.userChoice.finally(() => { deferredInstallPrompt = null; });
}
