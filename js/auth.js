// ============================================================================
// FOLIUM — Auth logic
// ============================================================================

// If already signed in, skip straight to the feed
auth.onAuthStateChanged(user => {
  if (user) window.location.href = 'index.html';
});

const loginForm = document.getElementById('loginForm');
const registerForm = document.getElementById('registerForm');
const toRegister = document.getElementById('toRegister');
const toLogin = document.getElementById('toLogin');
const authSub = document.getElementById('authSub');

toRegister.addEventListener('click', (e) => {
  e.preventDefault();
  loginForm.classList.add('hidden');
  registerForm.classList.remove('hidden');
  document.getElementById('toRegisterWrap').classList.add('hidden');
  document.getElementById('toLoginWrap').classList.remove('hidden');
  authSub.textContent = 'Join a community of writers and readers.';
});

toLogin.addEventListener('click', (e) => {
  e.preventDefault();
  registerForm.classList.add('hidden');
  loginForm.classList.remove('hidden');
  document.getElementById('toLoginWrap').classList.add('hidden');
  document.getElementById('toRegisterWrap').classList.remove('hidden');
  authSub.textContent = 'A quiet place to publish your writing.';
});

loginForm.addEventListener('submit', async (e) => {
  e.preventDefault();
  const email = document.getElementById('loginEmail').value.trim();
  const password = document.getElementById('loginPassword').value;
  const errEl = document.getElementById('loginError');
  const btn = document.getElementById('loginBtn');
  errEl.classList.add('hidden');
  btn.disabled = true; btn.textContent = 'Signing in…';
  try {
    await auth.signInWithEmailAndPassword(email, password);
    window.location.href = 'index.html';
  } catch (err) {
    errEl.textContent = friendlyAuthError(err);
    errEl.classList.remove('hidden');
    btn.disabled = false; btn.textContent = 'Sign in';
  }
});

registerForm.addEventListener('submit', async (e) => {
  e.preventDefault();
  const name = document.getElementById('regName').value.trim();
  const username = document.getElementById('regUsername').value.trim().toLowerCase();
  const email = document.getElementById('regEmail').value.trim();
  const password = document.getElementById('regPassword').value;
  const bio = document.getElementById('regBio').value.trim();
  const errEl = document.getElementById('registerError');
  const unameErr = document.getElementById('usernameError');
  const btn = document.getElementById('registerBtn');
  errEl.classList.add('hidden');
  unameErr.classList.add('hidden');

  if (!/^[a-zA-Z0-9_]{3,20}$/.test(username)) {
    unameErr.textContent = '3-20 characters: letters, numbers, underscores only.';
    unameErr.classList.remove('hidden');
    return;
  }

  btn.disabled = true; btn.textContent = 'Checking username…';
  try {
    const takenSnap = await db.collection('usernames').doc(username).get();
    if (takenSnap.exists) {
      unameErr.textContent = 'That username is already taken.';
      unameErr.classList.remove('hidden');
      btn.disabled = false; btn.textContent = 'Create account';
      return;
    }

    btn.textContent = 'Creating account…';
    const cred = await auth.createUserWithEmailAndPassword(email, password);
    const uid = cred.user.uid;

    await cred.user.updateProfile({ displayName: name });

    const batch = db.batch();
    batch.set(db.collection('users').doc(uid), {
      uid, name, username, email, bio: bio || '',
      photoURL: '', followerCount: 0, followingCount: 0, postCount: 0,
      createdAt: firebase.firestore.FieldValue.serverTimestamp()
    });
    batch.set(db.collection('usernames').doc(username), { uid });
    await batch.commit();

    window.location.href = 'index.html';
  } catch (err) {
    errEl.textContent = friendlyAuthError(err);
    errEl.classList.remove('hidden');
    btn.disabled = false; btn.textContent = 'Create account';
  }
});

function friendlyAuthError(err) {
  const map = {
    'auth/email-already-in-use': 'That email is already registered. Try signing in instead.',
    'auth/invalid-email': 'Please enter a valid email address.',
    'auth/weak-password': 'Password should be at least 6 characters.',
    'auth/user-not-found': 'No account found with that email.',
    'auth/wrong-password': 'Incorrect password. Please try again.',
    'auth/invalid-credential': 'Incorrect email or password.',
    'auth/too-many-requests': 'Too many attempts. Please wait a moment and try again.'
  };
  return map[err.code] || 'Something went wrong. Please try again.';
}
