// ============================================================================
// FOLIUM — Editor
// ============================================================================
let CURRENT_USER = null;
let editPostId = null; // set when editing an existing draft
let coverFile = null;
let tags = [];

const quill = new Quill('#editorBody', {
  theme: 'snow',
  placeholder: 'Write your story…',
  modules: {
    toolbar: [
      [{ header: [2, false] }],
      ['bold', 'italic', 'underline'],
      ['blockquote', 'link'],
      [{ list: 'ordered' }, { list: 'bullet' }],
      ['image'],
      ['clean']
    ]
  }
});

requireAuth(async (user) => {
  CURRENT_USER = await currentUserDoc(user.uid);
  const params = new URLSearchParams(location.search);
  editPostId = params.get('id');
  if (editPostId) await loadExistingDraft(editPostId);
});

async function loadExistingDraft(id) {
  const doc = await db.collection('posts').doc(id).get();
  if (!doc.exists || doc.data().authorId !== CURRENT_USER.uid) return;
  const data = doc.data();
  document.getElementById('titleInput').value = data.title || '';
  quill.root.innerHTML = data.contentHtml || '';
  tags = data.tags || [];
  renderTags();
  if (data.coverURL) {
    document.getElementById('coverPreview').src = data.coverURL;
    document.getElementById('coverPreview').classList.remove('hidden');
    document.getElementById('coverPlaceholder').classList.add('hidden');
  }
}

// --- Title auto-grow ---
const titleInput = document.getElementById('titleInput');
titleInput.addEventListener('input', () => {
  titleInput.style.height = 'auto';
  titleInput.style.height = titleInput.scrollHeight + 'px';
});

// --- Cover image ---
const coverPicker = document.getElementById('coverPicker');
const coverInput = document.getElementById('coverInput');
coverPicker.addEventListener('click', () => coverInput.click());
coverInput.addEventListener('change', () => {
  const file = coverInput.files[0];
  if (!file) return;
  coverFile = file;
  const reader = new FileReader();
  reader.onload = (e) => {
    const img = document.getElementById('coverPreview');
    img.src = e.target.result;
    img.classList.remove('hidden');
    document.getElementById('coverPlaceholder').classList.add('hidden');
  };
  reader.readAsDataURL(file);
});

// --- Tags ---
const tagInput = document.getElementById('tagInput');
tagInput.addEventListener('keydown', (e) => {
  if (e.key === 'Enter' && tagInput.value.trim()) {
    e.preventDefault();
    const val = tagInput.value.trim().toLowerCase().replace(/\s+/g, '-').slice(0, 24);
    if (!tags.includes(val) && tags.length < 5) tags.push(val);
    tagInput.value = '';
    renderTags();
  } else if (e.key === 'Backspace' && !tagInput.value && tags.length) {
    tags.pop();
    renderTags();
  }
});
function renderTags() {
  document.querySelectorAll('.tag-chip').forEach(el => el.remove());
  tags.forEach((tag, i) => {
    const chip = document.createElement('span');
    chip.className = 'tag-chip';
    chip.innerHTML = `${escapeHtml(tag)} <button type="button" data-i="${i}">×</button>`;
    chip.querySelector('button').addEventListener('click', () => { tags.splice(i, 1); renderTags(); });
    tagInput.parentNode.insertBefore(chip, tagInput);
  });
}

// --- Save / Publish ---
document.getElementById('draftBtn').addEventListener('click', () => savePost(false));
document.getElementById('publishBtn').addEventListener('click', () => {
  if (!titleInput.value.trim()) { showToast('Add a title before publishing.'); return; }
  document.getElementById('publishModal').classList.add('show');
});
document.getElementById('cancelPublish').addEventListener('click', () => document.getElementById('publishModal').classList.remove('show'));
document.getElementById('confirmPublish').addEventListener('click', () => {
  document.getElementById('publishModal').classList.remove('show');
  savePost(true);
});

async function uploadCoverIfNeeded() {
  if (!coverFile) return editPostId ? undefined : '';
  const path = `covers/${CURRENT_USER.uid}/${Date.now()}_${coverFile.name}`;
  const ref = storage.ref(path);
  await ref.put(coverFile);
  return await ref.getDownloadURL();
}

async function savePost(publish) {
  const title = titleInput.value.trim();
  const contentHtml = quill.root.innerHTML;
  const statusEl = document.getElementById('saveStatus');
  const btn = publish ? document.getElementById('publishBtn') : document.getElementById('draftBtn');
  btn.disabled = true;
  statusEl.textContent = publish ? 'Publishing…' : 'Saving…';

  try {
    const coverURL = await uploadCoverIfNeeded();
    const payload = {
      title: title || 'Untitled',
      contentHtml,
      excerpt: excerptFromHtml(contentHtml),
      tags,
      readingTime: readingTime(contentHtml),
      published: publish,
      authorId: CURRENT_USER.uid,
      authorName: CURRENT_USER.name,
      authorUsername: CURRENT_USER.username,
      authorPhoto: CURRENT_USER.photoURL || '',
      updatedAt: firebase.firestore.FieldValue.serverTimestamp()
    };
    if (coverURL !== undefined) payload.coverURL = coverURL;

    if (editPostId) {
      await db.collection('posts').doc(editPostId).update(payload);
    } else {
      payload.likeCount = 0;
      payload.commentCount = 0;
      payload.createdAt = firebase.firestore.FieldValue.serverTimestamp();
      const ref = await db.collection('posts').add(payload);
      editPostId = ref.id;
      history.replaceState(null, '', `write.html?id=${ref.id}`);
    }

    if (publish) {
      await db.collection('users').doc(CURRENT_USER.uid).update({ postCount: firebase.firestore.FieldValue.increment(1) });
      window.location.href = `post.html?id=${editPostId}`;
    } else {
      statusEl.textContent = 'Draft saved';
      setTimeout(() => statusEl.textContent = '', 2000);
    }
  } catch (err) {
    console.error(err);
    showToast('Couldn\u2019t save. Please try again.');
    statusEl.textContent = '';
  } finally {
    btn.disabled = false;
  }
}

// Autosave every 20s once there's a title or content
setInterval(() => {
  if (editPostId && (titleInput.value.trim() || quill.getText().trim())) savePost(false);
}, 20000);
