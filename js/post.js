// ============================================================================
// FOLIUM — Single post view
// ============================================================================
let CURRENT_USER = null;
let POST_ID = null;
let POST_DATA = null;
let IS_FOLLOWING = false;

requireAuth(async (user) => {
  CURRENT_USER = await currentUserDoc(user.uid);
  document.getElementById('navAvatar').innerHTML = avatarHtml(CURRENT_USER, 'avatar--sm');
  document.getElementById('profileLink').href = `profile.html?u=${CURRENT_USER.username}`;

  POST_ID = new URLSearchParams(location.search).get('id');
  if (!POST_ID) { renderNotFound(); return; }
  await loadPost();
});

async function loadPost() {
  const el = document.getElementById('postContent');
  try {
    const doc = await db.collection('posts').doc(POST_ID).get();
    if (!doc.exists) { renderNotFound(); return; }
    POST_DATA = { id: doc.id, ...doc.data() };
    document.getElementById('pageTitle').textContent = `${POST_DATA.title} — Folium`;

    const [likeDoc, followDoc] = await Promise.all([
      db.collection('posts').doc(POST_ID).collection('likes').doc(CURRENT_USER.uid).get(),
      db.collection('users').doc(CURRENT_USER.uid).collection('following').doc(POST_DATA.authorId).get()
    ]);
    IS_FOLLOWING = followDoc.exists;

    const created = POST_DATA.createdAt && POST_DATA.createdAt.toDate ? POST_DATA.createdAt.toDate() : new Date();
    const isOwner = POST_DATA.authorId === CURRENT_USER.uid;

    el.innerHTML = `
      ${POST_DATA.tags && POST_DATA.tags.length ? `<div class="post-kicker">${escapeHtml(POST_DATA.tags[0])}</div>` : ''}
      <h1 class="post-title">${escapeHtml(POST_DATA.title)}</h1>
      <div class="post-byline">
        ${avatarHtml({ name: POST_DATA.authorName, photoURL: POST_DATA.authorPhoto }, 'avatar--lg')}
        <div class="info">
          <div class="name"><a href="profile.html?u=${POST_DATA.authorUsername}">${escapeHtml(POST_DATA.authorName)}</a></div>
          <div class="date">${formatDate(created)} · ${POST_DATA.readingTime || 1} min read</div>
        </div>
        ${isOwner
          ? `<a href="write.html?id=${POST_DATA.id}" class="btn btn--ghost btn--sm">Edit</a>`
          : `<button class="btn ${IS_FOLLOWING ? 'btn--ghost is-following' : 'btn--outline'} btn--sm btn--follow" id="followBtn">${IS_FOLLOWING ? 'Following' : 'Follow'}</button>`}
      </div>
      ${POST_DATA.coverURL ? `<img class="post-cover" src="${POST_DATA.coverURL}" alt="">` : ''}
      <div class="post-content">${POST_DATA.contentHtml || ''}</div>
      ${POST_DATA.tags && POST_DATA.tags.length ? `<div class="post-tags">${POST_DATA.tags.map(t => `<span class="post-tag">${escapeHtml(t)}</span>`).join('')}</div>` : ''}
      <div class="post-actionbar">
        <div class="action-row">
          <button class="action like-btn ${likeDoc.exists ? 'is-active' : ''}" id="likeBtn">
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M20.8 4.6a5.5 5.5 0 0 0-7.8 0L12 5.6l-1-1a5.5 5.5 0 0 0-7.8 7.8l1 1L12 21l7.8-7.8 1-1a5.5 5.5 0 0 0 0-7.8Z"/></svg>
            <span>${POST_DATA.likeCount || 0}</span>
          </button>
          <a class="action" href="#comments">
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z"/></svg>
            <span>${POST_DATA.commentCount || 0}</span>
          </a>
        </div>
        <button class="action" id="shareBtn">
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="18" cy="5" r="3"/><circle cx="6" cy="12" r="3"/><circle cx="18" cy="19" r="3"/><path d="m8.6 13.5 6.8 4M15.4 6.5l-6.8 4"/></svg>
          Share
        </button>
      </div>
      <div class="comments" id="comments">
        <h3>Responses (<span id="commentCountLabel">${POST_DATA.commentCount || 0}</span>)</h3>
        <form class="comment-form" id="commentForm">
          ${avatarHtml(CURRENT_USER, 'avatar--sm')}
          <textarea id="commentInput" placeholder="What are your thoughts?" required></textarea>
        </form>
        <div id="commentList"></div>
      </div>
    `;

    wirePostActions(isOwner);
    listenComments();
  } catch (err) {
    console.error(err);
    renderNotFound();
  }
}

function wirePostActions(isOwner) {
  document.getElementById('likeBtn').addEventListener('click', toggleLike);
  document.getElementById('shareBtn').addEventListener('click', () => {
    shareOrCopy(window.location.href, POST_DATA.title);
  });
  if (!isOwner) {
    document.getElementById('followBtn').addEventListener('click', toggleFollow);
  }
  document.getElementById('commentForm').addEventListener('submit', submitComment);
}

async function toggleLike() {
  const btn = document.getElementById('likeBtn');
  const countSpan = btn.querySelector('span');
  const postRef = db.collection('posts').doc(POST_ID);
  const likeRef = postRef.collection('likes').doc(CURRENT_USER.uid);
  const isLiked = btn.classList.contains('is-active');
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
    showToast('Couldn\u2019t update like.');
  }
}

async function toggleFollow() {
  const btn = document.getElementById('followBtn');
  btn.disabled = true;
  const targetUid = POST_DATA.authorId;
  const batch = db.batch();
  const followingRef = db.collection('users').doc(CURRENT_USER.uid).collection('following').doc(targetUid);
  const followerRef = db.collection('users').doc(targetUid).collection('followers').doc(CURRENT_USER.uid);
  try {
    if (IS_FOLLOWING) {
      batch.delete(followingRef);
      batch.delete(followerRef);
      batch.update(db.collection('users').doc(CURRENT_USER.uid), { followingCount: firebase.firestore.FieldValue.increment(-1) });
      batch.update(db.collection('users').doc(targetUid), { followerCount: firebase.firestore.FieldValue.increment(-1) });
      await batch.commit();
      IS_FOLLOWING = false;
      btn.textContent = 'Follow';
      btn.className = 'btn btn--outline btn--sm btn--follow';
    } else {
      batch.set(followingRef, { createdAt: firebase.firestore.FieldValue.serverTimestamp() });
      batch.set(followerRef, { createdAt: firebase.firestore.FieldValue.serverTimestamp() });
      batch.update(db.collection('users').doc(CURRENT_USER.uid), { followingCount: firebase.firestore.FieldValue.increment(1) });
      batch.update(db.collection('users').doc(targetUid), { followerCount: firebase.firestore.FieldValue.increment(1) });
      await batch.commit();
      IS_FOLLOWING = true;
      btn.textContent = 'Following';
      btn.className = 'btn btn--ghost is-following btn--sm btn--follow';
    }
  } catch (err) {
    console.error(err);
    showToast('Couldn\u2019t update follow status.');
  } finally {
    btn.disabled = false;
  }
}

async function submitComment(e) {
  e.preventDefault();
  const input = document.getElementById('commentInput');
  const text = input.value.trim();
  if (!text) return;
  const submitBtn = e.target.querySelector('button');
  input.disabled = true;

  try {
    const batch = db.batch();
    const commentRef = db.collection('posts').doc(POST_ID).collection('comments').doc();
    batch.set(commentRef, {
      text, authorId: CURRENT_USER.uid, authorName: CURRENT_USER.name, authorPhoto: CURRENT_USER.photoURL || '',
      createdAt: firebase.firestore.FieldValue.serverTimestamp()
    });
    batch.update(db.collection('posts').doc(POST_ID), { commentCount: firebase.firestore.FieldValue.increment(1) });
    await batch.commit();
    input.value = '';
  } catch (err) {
    console.error(err);
    showToast('Couldn\u2019t post your comment.');
  } finally {
    input.disabled = false;
  }
}

function listenComments() {
  db.collection('posts').doc(POST_ID).collection('comments').orderBy('createdAt', 'desc')
    .onSnapshot(snap => {
      const list = document.getElementById('commentList');
      if (!list) return;
      if (snap.empty) {
        list.innerHTML = '<p style="color:var(--ink-faint); font-size:14px; padding: 20px 0;">No responses yet. Be the first to share your thoughts.</p>';
        return;
      }
      list.innerHTML = snap.docs.map(d => {
        const c = d.data();
        const created = c.createdAt && c.createdAt.toDate ? c.createdAt.toDate() : new Date();
        return `
        <div class="comment">
          ${avatarHtml({ name: c.authorName, photoURL: c.authorPhoto }, 'avatar--sm')}
          <div class="bubble">
            <span class="name">${escapeHtml(c.authorName)}</span><span class="time">${timeAgo(created)}</span>
            <div class="text">${escapeHtml(c.text)}</div>
          </div>
        </div>`;
      }).join('');
      document.getElementById('commentCountLabel').textContent = snap.size;
    });
}

function renderNotFound() {
  document.getElementById('postContent').innerHTML = `
    <div class="empty-state">
      <h3>Story not found</h3>
      <p>It may have been removed, or the link is incorrect.</p>
      <a href="index.html" class="btn btn--primary" style="margin-top:16px;">Back to Folium</a>
    </div>`;
}
