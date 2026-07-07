// ============================================================================
// FOLIUM — Explore / search
// ============================================================================
let CURRENT_USER = null;

requireAuth(async (user) => {
  CURRENT_USER = await currentUserDoc(user.uid);
  document.getElementById('navAvatar').innerHTML = avatarHtml(CURRENT_USER, 'avatar--sm');
  document.getElementById('profileLink').href = `profile.html?u=${CURRENT_USER.username}`;

  const params = new URLSearchParams(location.search);
  const tag = params.get('tag');
  const q = params.get('q');
  document.getElementById('searchInput').value = q || '';

  if (tag) {
    document.getElementById('resultsHeading').textContent = `#${tag}`;
    await searchByTag(tag);
  } else if (q) {
    document.getElementById('resultsHeading').textContent = `Results for "${q}"`;
    await searchByTitle(q);
  } else {
    document.getElementById('resultsHeading').textContent = 'Explore';
    await searchByTitle('');
  }
});

document.getElementById('searchInput').addEventListener('keydown', (e) => {
  if (e.key === 'Enter' && e.target.value.trim()) {
    window.location.href = `explore.html?q=${encodeURIComponent(e.target.value.trim())}`;
  }
});

async function searchByTag(tag) {
  const list = document.getElementById('resultsList');
  const snap = await db.collection('posts').where('published', '==', true).where('tags', 'array-contains', tag)
    .orderBy('createdAt', 'desc').limit(30).get();
  renderResults(list, snap.docs.map(d => ({ id: d.id, ...d.data() })));
}

async function searchByTitle(q) {
  const list = document.getElementById('resultsList');
  const snap = await db.collection('posts').where('published', '==', true).orderBy('createdAt', 'desc').limit(50).get();
  let posts = snap.docs.map(d => ({ id: d.id, ...d.data() }));
  if (q) {
    const needle = q.toLowerCase();
    posts = posts.filter(p =>
      (p.title || '').toLowerCase().includes(needle) ||
      (p.authorName || '').toLowerCase().includes(needle) ||
      (p.tags || []).some(t => t.includes(needle))
    );
  }
  renderResults(list, posts);
}

function renderResults(list, posts) {
  if (posts.length === 0) {
    list.innerHTML = '<div class="empty-state"><h3>No stories found</h3><p>Try a different search term or tag.</p></div>';
    return;
  }
  list.innerHTML = posts.map(post => {
    const created = post.createdAt && post.createdAt.toDate ? post.createdAt.toDate() : new Date();
    return `
    <article class="story">
      <div>
        <div class="story__byline"><b>${escapeHtml(post.authorName)}</b> · ${timeAgo(created)} · ${post.readingTime || 1} min read</div>
        <a href="post.html?id=${post.id}"><h2 class="story__title">${escapeHtml(post.title)}</h2></a>
        <p class="story__excerpt">${escapeHtml(post.excerpt || '')}</p>
      </div>
      ${post.coverURL ? `<div class="story__cover"><img src="${post.coverURL}" alt=""></div>` : ''}
    </article>`;
  }).join('');
}
