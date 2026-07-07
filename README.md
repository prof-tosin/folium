# Folium — Setup Guide

A full writing platform: registration, profiles, publishing (rich text + cover
images), likes, comments, follows, share, search/tags, and an installable PWA
for Android and iOS.

## What you're getting

```
folium/
├─ index.html        Home feed (Following / Explore / Trending)
├─ auth.html          Sign in / register
├─ write.html         Rich-text editor (publish or save draft)
├─ post.html          Single story view (like, comment, share, follow)
├─ profile.html       Profile page (stories, followers, edit)
├─ explore.html       Search + tag browsing
├─ manifest.json      PWA manifest
├─ sw.js              Service worker (offline app shell + installability)
├─ firestore.rules     Firestore security rules
├─ storage.rules        Storage security rules (cover images)
├─ firestore.indexes.json
├─ firebase.json        Hosting + deploy config
├─ css/style.css
├─ js/ (firebase-config.js, utils.js, auth.js, app.js, editor.js, post.js, profile.js, explore.js)
└─ icons/ (192, 512, maskable, apple-touch)
```

Stack: **Firebase Auth + Firestore + Storage + Hosting**, vanilla JS — no
build step, no framework, deploys as static files. Matches the architecture
you already use for your other projects.

---

## Step 1 — Create the Firebase project

1. Go to https://console.firebase.google.com → **Add project** → name it
   (e.g. "folium" or your own brand) → finish the wizard.
2. In the project, go to **Build → Authentication → Get started** → enable
   the **Email/Password** sign-in method.
3. Go to **Build → Firestore Database → Create database** → start in
   **production mode** → pick a region close to your users.
4. Go to **Build → Storage → Get started** → production mode, same region.
5. Go to **Project settings (gear icon) → General → Your apps → Web (`</>`)**
   → register an app (nickname anything) → **copy the `firebaseConfig` object**.

## Step 2 — Add your config

Open `js/firebase-config.js` and paste your real values in place of the
placeholders:

```js
const firebaseConfig = {
  apiKey: "AIza...",
  authDomain: "your-project.firebaseapp.com",
  projectId: "your-project",
  storageBucket: "your-project.appspot.com",
  messagingSenderId: "...",
  appId: "..."
};
```

## Step 3 — Deploy security rules and indexes

You need the Firebase CLI once, then it's a two-line deploy from now on.

```bash
npm install -g firebase-tools
firebase login
cd folium
firebase use --add        # pick your project, give it an alias like "default"
firebase deploy --only firestore:rules,firestore:indexes,storage
```

This pushes `firestore.rules`, `firestore.indexes.json`, and `storage.rules`
— without these, reads/writes will fail with "permission denied," and some
feed queries won't run until their composite index finishes building
(Firebase Console → Firestore → Indexes will show progress).

## Step 4 — Deploy the site (Firebase Hosting)

```bash
firebase init hosting     # if not already initialized — point "public" to "."
firebase deploy --only hosting
```

You'll get a live URL like `https://your-project.web.app`. Every later change
is just `firebase deploy --only hosting` again.

**Alternative hosts** (also fully static, no server needed): Vercel, Netlify,
or GitHub Pages — same as your other projects. Just make sure whichever host
you pick serves `sw.js` from the site root, or the PWA install prompt won't
qualify.

## Step 5 — Make it installable (PWA)

This is already wired up:
- `manifest.json` — app name, icons, theme colors, standalone display mode
- `sw.js` — service worker registered from `js/utils.js`
- Icons in `/icons` (192, 512, maskable, apple-touch)

Requirements for install to actually trigger:
- **HTTPS** — Firebase Hosting, Vercel, Netlify, and GitHub Pages all give you
  this automatically.
- Visit the site at least once so the service worker registers.

**On Android (Chrome):** visit the site → a small install icon appears in
the address bar, or use the in-app "Install" button (top-right, appears once
Chrome fires its install prompt) → **Add to Home screen**.

**On iPhone/iPad (Safari):** Safari doesn't show an automatic install
banner — that's an Apple platform limitation, not a bug in the app. Tell
users: open the site in Safari → tap **Share** → **Add to Home Screen**. It
still launches full-screen with your icon, exactly like a native app.

## Step 6 — Test it end to end

1. Open the deployed URL → **Create an account** (auth.html) — fill name,
   username, email, password.
2. Click **Write** → add a title, cover image, some formatted text, a tag or
   two → **Publish**.
3. Open the post → try **Like**, add a **comment**, hit **Share** (native
   share sheet on mobile, clipboard copy on desktop).
4. Visit another account's profile → **Follow** → check it shows up in your
   **Following** feed.
5. On your phone, confirm the **Install** flow from Step 5.

---

## Data model (for reference / future features)

| Collection | Purpose |
|---|---|
| `users/{uid}` | name, username, bio, photoURL, follower/following/post counts |
| `usernames/{username}` | uid — enforces unique usernames at signup |
| `users/{uid}/following/{targetUid}` | who this user follows |
| `users/{uid}/followers/{followerUid}` | who follows this user |
| `posts/{postId}` | title, contentHtml, excerpt, tags, coverURL, published, counts |
| `posts/{postId}/likes/{uid}` | one doc per like, keeps `likeCount` in sync |
| `posts/{postId}/comments/{commentId}` | text, author, timestamp |

## Notes and known limits (worth knowing before you scale)

- The **Following** feed uses Firestore's `in` query, capped at 10 IDs per
  query. If someone follows more than 10 writers, only the first 10 are
  queried for now — fine at launch, but worth revisiting (e.g. a fan-out
  write to a per-user feed collection) once you have real usage.
- Search is client-side substring matching over the most recent 50 published
  posts — good enough to launch with, but won't scale to thousands of posts.
  When you're ready, Algolia or Typesense (both have generous free tiers and
  official Firestore sync extensions) are the standard upgrade path.
- Image moderation isn't implemented — anyone can upload a cover image.
  Consider Firebase Extensions like "Resize Images" plus a manual report
  / moderation flow before opening registration publicly.
- Email verification isn't enforced. To require it, call
  `cred.user.sendEmailVerification()` after signup and gate posting until
  `user.emailVerified` is true.

## Next features worth adding (your call, happy to build any of these)

- Push notifications (new follower, new comment) — Firebase Cloud Messaging
- Email verification + password reset flow
- Reading lists / bookmarks
- Admin/moderation dashboard
- Rich profile customization (banner image, social links)
