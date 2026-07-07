// ============================================================================
// FOLIUM — Profile page
// ============================================================================
let CURRENT_USER = null;
let PROFILE_USER = null;
let IS_OWN_PROFILE = false;
let IS_FOLLOWING = false;

requireAuth(async (user) => {
  CURRENT_USER = await currentUserDoc(user.uid);
  const username = new URLSearchParams(location.search).get('u') || CURRENT_USER.username;
  await loadProfile(username);
});

document.getElementById('signOutBtn').addEventListener('click', async () => {
  await auth.signOut();
  window.location.href = 'auth.html';
});

async function loadProfile(username) {
  const unameDoc = await db.collection('usernames').doc(username).get();
  if (!unameDoc.exists) { renderNotFound(); return; }
  const userDoc = await db.collection('users').doc(unameDoc.data().uid).get();
  PROFILE_USER = { uid: userDoc.id, ...userDoc.data() };
  IS_OWN_PROFILE = PROFILE_USER.uid === CURRENT_USER.uid;
  document.getElementById('pageTitle').textContent = `${PROFILE_USER.name} — Folium`;

  if (!IS_OWN_PROFILE) {
    const followDoc = await db.collection('users').doc(CURRENT_USER.uid).collection('following').doc(PROFILE_USER.uid).get();
    IS_FOLLOWING = followDoc.exists;
  }

  renderHeader();
  document.getElementById('profileTabs').style.display = 'flex';
  document.querySelectorAll('#profileTabs button').forEach(btn => {
    btn.addEventListener('click', () => {
      document.querySelectorAll('#profileTabs button').forEach(b => b.classList.remove('active'));
      btn.classList.add('active');
      loadTab(btn.dataset.tab);
    });
  });
  loadTab('posts');
}

function renderHeader() {
  const el = document.getElementById('profileHeader');
  el.innerHTML = `
    <div class="profile-header">
      ${avatarHtml(PROFILE_USER, 'avatar--lg')}
      <div class="info">
        <h1 class="profile-name">${escapeHtml(PROFILE_USER.name)}</h1>
        <div class="profile-handle">@${escapeHtml(PROFILE_USER.username)}</div>
        ${PROFILE_USER.bio ? `<p class="profile-bio">${escapeHtml(PROFILE_USER.bio)}</p>` : ''}
        <div class="profile-stats">
          <span><b>${PROFILE_USER.postCount || 0}</b> Stories</span>
          <span><b>${PROFILE_USER.followerCount || 0}</b> Followers</span>
          <span><b>${PROFILE_USER.followingCount || 0}</b> Following</span>
        </div>
      </div>
      ${IS_OWN_PROFILE
        ? `<button class="btn btn--ghost" id="editProfileBtn">Edit profile</button>`
        : `<button class="btn ${IS_FOLLOWING ? 'btn--ghost is-following' : 'btn--outline'} btn--follow" id="followBtn">${IS_FOLLOWING ? 'Following' : 'Follow'}</button>`}
    </div>`;

  if (IS_OWN_PROFILE) {
    document.getElementById('editProfileBtn').addEventListener('click', openEditModal);
  } else {
    document.getElementById('followBtn').addEventListener('click', toggleFollow);
  }
}

async function loadTab(tab) {
  const body = document.getElementById('profileBody');
  body.innerHTML = '<div class="spinner"></div>';
  let posts = [];
  try {
    if (tab === 'posts') {
      const query = IS_OWN_PROFILE
        ? db.collection('posts').where('authorId', '==', PROFILE_USER.uid).orderBy('createdAt', 'desc')
        : db.collection('posts').where('authorId', '==', PROFILE_USER.uid).where('published', '==', true).orderBy('createdAt', 'desc');
      const snap = await query.get();
      posts = snap.docs.map(d => ({ id: d.id, ...d.data() }));
    } else if (tab === 'likes') {
      body.innerHTML = '<p style="color:var(--ink-faint); padding:40px 0; text-align:center;">Liked stories are private to each reader and only visible on their own profile.</p>';
      return;
    } else if (tab === 'about') {
      body.innerHTML = `
        <div style="padding: 32px 0;">
          <p style="color:var(--ink-soft); line-height:1.7;">${escapeHtml(PROFILE_USER.bio || 'This writer hasn\u2019t added a bio yet.')}</p>
          <p style="color:var(--ink-faint); font-size:13px; margin-top:16px;">Joined ${PROFILE_USER.createdAt ? formatDate(PROFILE_USER.createdAt.toDate()) : ''}</p>
        </div>`;
      return;
    }
  } catch (err) {
    console.error(err);
    body.innerHTML = '<div class="empty-state"><h3>Couldn\u2019t load stories</h3></div>';
    return;
  }

  if (posts.length === 0) {
    body.innerHTML = `<div class="empty-state"><h3>No stories yet</h3><p>${IS_OWN_PROFILE ? 'Your published and draft stories will appear here.' : 'This writer hasn\u2019t published anything yet.'}</p></div>`;
    return;
  }

  body.innerHTML = posts.map(post => {
    const created = post.createdAt && post.createdAt.toDate ? post.createdAt.toDate() : new Date();
    return `
    <article class="story">
      <div>
        <div class="story__byline">${timeAgo(created)} · ${post.readingTime || 1} min read ${!post.published ? '· <b>Draft</b>' : ''}</div>
        <a href="${post.published ? `post.html?id=${post.id}` : `write.html?id=${post.id}`}"><h2 class="story__title">${escapeHtml(post.title)}</h2></a>
        <p class="story__excerpt">${escapeHtml(post.excerpt || '')}</p>
        <div class="story__meta">
          <div class="action-row">
            <span class="action"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M20.8 4.6a5.5 5.5 0 0 0-7.8 0L12 5.6l-1-1a5.5 5.5 0 0 0-7.8 7.8l1 1L12 21l7.8-7.8 1-1a5.5 5.5 0 0 0 0-7.8Z"/></svg> ${post.likeCount || 0}</span>
            <span class="action"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z"/></svg> ${post.commentCount || 0}</span>
          </div>
        </div>
      </div>
      ${post.coverURL ? `<div class="story__cover"><img src="${post.coverURL}" alt=""></div>` : ''}
    </article>`;
  }).join('');
}

async function toggleFollow() {
  const btn = document.getElementById('followBtn');
  btn.disabled = true;
  const batch = db.batch();
  const followingRef = db.collection('users').doc(CURRENT_USER.uid).collection('following').doc(PROFILE_USER.uid);
  const followerRef = db.collection('users').doc(PROFILE_USER.uid).collection('followers').doc(CURRENT_USER.uid);
  try {
    if (IS_FOLLOWING) {
      batch.delete(followingRef);
      batch.delete(followerRef);
      batch.update(db.collection('users').doc(CURRENT_USER.uid), { followingCount: firebase.firestore.FieldValue.increment(-1) });
      batch.update(db.collection('users').doc(PROFILE_USER.uid), { followerCount: firebase.firestore.FieldValue.increment(-1) });
      await batch.commit();
      IS_FOLLOWING = false;
      PROFILE_USER.followerCount = Math.max(0, (PROFILE_USER.followerCount || 1) - 1);
    } else {
      batch.set(followingRef, { createdAt: firebase.firestore.FieldValue.serverTimestamp() });
      batch.set(followerRef, { createdAt: firebase.firestore.FieldValue.serverTimestamp() });
      batch.update(db.collection('users').doc(CURRENT_USER.uid), { followingCount: firebase.firestore.FieldValue.increment(1) });
      batch.update(db.collection('users').doc(PROFILE_USER.uid), { followerCount: firebase.firestore.FieldValue.increment(1) });
      await batch.commit();
      IS_FOLLOWING = true;
      PROFILE_USER.followerCount = (PROFILE_USER.followerCount || 0) + 1;
    }
    renderHeader();
  } catch (err) {
    console.error(err);
    showToast('Couldn\u2019t update follow status.');
    btn.disabled = false;
  }
}

function openEditModal() {
  document.getElementById('editName').value = PROFILE_USER.name;
  document.getElementById('editBio').value = PROFILE_USER.bio || '';
  document.getElementById('editModal').classList.add('show');
}
document.getElementById('cancelEdit').addEventListener('click', () => document.getElementById('editModal').classList.remove('show'));
document.getElementById('saveEdit').addEventListener('click', async () => {
  const name = document.getElementById('editName').value.trim();
  const bio = document.getElementById('editBio').value.trim();
  if (!name) { showToast('Name can\u2019t be empty.'); return; }
  await db.collection('users').doc(CURRENT_USER.uid).update({ name, bio });
  PROFILE_USER.name = name;
  PROFILE_USER.bio = bio;
  document.getElementById('editModal').classList.remove('show');
  renderHeader();
  showToast('Profile updated');
});

function renderNotFound() {
  document.getElementById('profileHeader').innerHTML = `
    <div class="empty-state"><h3>Writer not found</h3><p>This profile doesn\u2019t exist.</p></div>`;
}
