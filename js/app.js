// ============================================================================
// FOLIUM — Home feed
// ============================================================================
let CURRENT_USER = null;
let FOLLOWING_IDS = [];
let activeTab = 'following';

requireAuth(async (user) => {
  CURRENT_USER = await currentUserDoc(user.uid);
  renderNavAvatar();
  await loadFollowingIds();
  loadFeed(activeTab);
  loadSuggestions();
  loadTagCloud();
});

function renderNavAvatar() {
  document.getElementById('navAvatar').innerHTML = avatarHtml(CURRENT_USER, 'avatar--sm');
  const profileHref = `profile.html?u=${CURRENT_USER.username}`;
  document.getElementById('profileLink').href = profileHref;
  document.getElementById('bottomProfile').href = profileHref;
}

document.getElementById('bottomSearch').addEventListener('click', (e) => {
  e.preventDefault();
  document.getElementById('searchInput').focus();
});

async function loadFollowingIds() {
  const snap = await db.collection('users').doc(CURRENT_USER.uid).collection('following').get();
  FOLLOWING_IDS = snap.docs.map(d => d.id);
}

document.querySelectorAll('.tabs button').forEach(btn => {
  btn.addEventListener('click', () => {
    document.querySelectorAll('.tabs button').forEach(b => b.classList.remove('active'));
    btn.classList.add('active');
    activeTab = btn.dataset.tab;
    loadFeed(activeTab);
  });
});

async function loadFeed(tab) {
  const list = document.getElementById('feedList');
  list.innerHTML = '<div class="spinner"></div>';

  let posts = [];
  try {
    if (tab === 'following') {
      if (FOLLOWING_IDS.length === 0) {
        renderEmpty(list, 'Follow some writers', 'Stories from people you follow will show up here. Try Explore to discover writers.');
        return;
      }
      const ids = FOLLOWING_IDS.slice(0, 10); // Firestore 'in' query limit
      const snap = await db.collection('posts')
        .where('published', '==', true)
        .where('authorId', 'in', ids)
        .orderBy('createdAt', 'desc').limit(20).get();
      posts = snap.docs.map(d => ({ id: d.id, ...d.data() }));
    } else if (tab === 'trending') {
      const snap = await db.collection('posts')
        .where('published', '==', true)
        .orderBy('likeCount', 'desc').limit(20).get();
      posts = snap.docs.map(d => ({ id: d.id, ...d.data() }));
    } else {
      const snap = await db.collection('posts')
        .where('published', '==', true)
        .orderBy('createdAt', 'desc').limit(20).get();
      posts = snap.docs.map(d => ({ id: d.id, ...d.data() }));
    }
  } catch (err) {
    console.error(err);
    renderEmpty(list, 'Couldn\u2019t load stories', 'Check your connection and try again.');
    return;
  }

  if (posts.length === 0) {
    renderEmpty(list, 'Nothing here yet', 'Be the first to publish a story in this feed.');
    return;
  }

  list.innerHTML = posts.map(renderStoryCard).join('');
  wireStoryActions(list, posts);
}

function renderEmpty(container, title, sub) {
  container.innerHTML = `<div class="empty-state"><h3>${title}</h3><p>${sub}</p></div>`;
}

function renderStoryCard(post) {
  const created = post.createdAt && post.createdAt.toDate ? post.createdAt.toDate() : new Date();
  const liked = post._likedByMe ? 'is-active' : '';
  return `
  <article class="story" data-id="${post.id}">
    <div>
      <div class="story__byline">
        ${avatarHtml({ name: post.authorName, photoURL: post.authorPhoto }, 'avatar--sm')}
        <b>${escapeHtml(post.authorName)}</b> · ${timeAgo(created)} · ${post.readingTime || 1} min read
      </div>
      <a href="post.html?id=${post.id}"><h2 class="story__title">${escapeHtml(post.title)}</h2></a>
      <p class="story__excerpt">${escapeHtml(post.excerpt || '')}</p>
      <div class="story__meta">
        <div class="action-row">
          <button class="action like-btn ${liked}" data-id="${post.id}">
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M20.8 4.6a5.5 5.5 0 0 0-7.8 0L12 5.6l-1-1a5.5 5.5 0 0 0-7.8 7.8l1 1L12 21l7.8-7.8 1-1a5.5 5.5 0 0 0 0-7.8Z"/></svg>
            <span>${post.likeCount || 0}</span>
          </button>
          <a class="action" href="post.html?id=${post.id}#comments">
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z"/></svg>
            <span>${post.commentCount || 0}</span>
          </a>
          <button class="action share-btn" data-id="${post.id}" data-title="${escapeHtml(post.title)}">
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="18" cy="5" r="3"/><circle cx="6" cy="12" r="3"/><circle cx="18" cy="19" r="3"/><path d="m8.6 13.5 6.8 4M15.4 6.5l-6.8 4"/></svg>
          </button>
        </div>
        ${(post.likeCount || 0) > 20 ? '<span class="story__stamp">Editor\u2019s pick</span>' : ''}
      </div>
    </div>
    ${post.coverURL ? `<div class="story__cover"><img src="${post.coverURL}" alt=""></div>` : ''}
  </article>`;
}

function wireStoryActions(container, posts) {
  container.querySelectorAll('.like-btn').forEach(btn => {
    btn.addEventListener('click', () => toggleLike(btn.dataset.id, btn));
  });
  container.querySelectorAll('.share-btn').forEach(btn => {
    btn.addEventListener('click', () => {
      const url = `${window.location.origin}/post.html?id=${btn.dataset.id}`;
      shareOrCopy(url, btn.dataset.title);
    });
  });
  // check like state for visible posts
  posts.forEach(async (post) => {
    const likeDoc = await db.collection('posts').doc(post.id).collection('likes').doc(CURRENT_USER.uid).get();
    if (likeDoc.exists) {
      const btn = container.querySelector(`.like-btn[data-id="${post.id}"]`);
      if (btn) btn.classList.add('is-active');
    }
  });
}

async function toggleLike(postId, btn) {
  const postRef = db.collection('posts').doc(postId);
  const likeRef = postRef.collection('likes').doc(CURRENT_USER.uid);
  const isLiked = btn.classList.contains('is-active');
  const countSpan = btn.querySelector('span');
  let count = parseInt(countSpan.textContent, 10) || 0;

  btn.classList.toggle('is-active');
  countSpan.textContent = isLiked ? Math.max(0, count - 1) : count + 1;

  try {
    await db.runTransaction(async (tx) => {
      const likeDoc = await tx.get(likeRef);
      if (likeDoc.exists) {
        tx.delete(likeRef);
        tx.update(postRef, { likeCount: firebase.firestore.FieldValue.increment(-1) });
      } else {
        tx.set(likeRef, { createdAt: firebase.firestore.FieldValue.serverTimestamp() });
        tx.update(postRef, { likeCount: firebase.firestore.FieldValue.increment(1) });
      }
    });
  } catch (err) {
    console.error(err);
    showToast('Couldn\u2019t update like. Try again.');
  }
}

async function loadSuggestions() {
  const box = document.getElementById('suggestList');
  try {
    const snap = await db.collection('users').orderBy('followerCount', 'desc').limit(6).get();
    const users = snap.docs.map(d => d.data()).filter(u => u.uid !== CURRENT_USER.uid);
    if (users.length === 0) { box.innerHTML = '<p style="color:var(--ink-faint); font-size:13px;">No suggestions yet.</p>'; return; }
    box.innerHTML = users.slice(0, 5).map(u => `
      <div class="suggest-row">
        ${avatarHtml(u, 'avatar--sm')}
        <div>
          <div class="name"><a href="profile.html?u=${u.username}">${escapeHtml(u.name)}</a></div>
          <div class="handle">@${u.username}</div>
        </div>
        <button class="btn btn--outline btn--sm follow-sugg" data-uid="${u.uid}">Follow</button>
      </div>`).join('');
    box.querySelectorAll('.follow-sugg').forEach(btn => {
      btn.addEventListener('click', async () => {
        btn.disabled = true;
        await followUser(btn.dataset.uid);
        btn.textContent = 'Following';
        btn.classList.add('is-following');
      });
    });
  } catch (err) {
    console.error(err);
    box.innerHTML = '';
  }
}

async function followUser(targetUid) {
  if (targetUid === CURRENT_USER.uid) return;
  const batch = db.batch();
  batch.set(db.collection('users').doc(CURRENT_USER.uid).collection('following').doc(targetUid), { createdAt: firebase.firestore.FieldValue.serverTimestamp() });
  batch.set(db.collection('users').doc(targetUid).collection('followers').doc(CURRENT_USER.uid), { createdAt: firebase.firestore.FieldValue.serverTimestamp() });
  batch.update(db.collection('users').doc(CURRENT_USER.uid), { followingCount: firebase.firestore.FieldValue.increment(1) });
  batch.update(db.collection('users').doc(targetUid), { followerCount: firebase.firestore.FieldValue.increment(1) });
  await batch.commit();
  FOLLOWING_IDS.push(targetUid);
}

async function loadTagCloud() {
  const box = document.getElementById('tagCloud');
  try {
    const snap = await db.collection('posts').where('published', '==', true).orderBy('createdAt', 'desc').limit(50).get();
    const counts = {};
    snap.docs.forEach(d => (d.data().tags || []).forEach(t => counts[t] = (counts[t] || 0) + 1));
    const top = Object.entries(counts).sort((a, b) => b[1] - a[1]).slice(0, 10);
    if (top.length === 0) { box.innerHTML = '<p style="color:var(--ink-faint); font-size:13px;">Tags will appear as stories are published.</p>'; return; }
    box.innerHTML = top.map(([tag]) => `<a href="explore.html?tag=${encodeURIComponent(tag)}" class="post-tag">${escapeHtml(tag)}</a>`).join('');
  } catch (err) {
    box.innerHTML = '';
  }
}

const searchInput = document.getElementById('searchInput');
searchInput.addEventListener('keydown', (e) => {
  if (e.key === 'Enter' && searchInput.value.trim()) {
    window.location.href = `explore.html?q=${encodeURIComponent(searchInput.value.trim())}`;
  }
});
