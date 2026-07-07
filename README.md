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
├─ firebase.json        (optional — only needed if you ever use the Firebase CLI instead)
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

## Step 3 — Deploy security rules and indexes (no CLI needed — Console only)

Everything here is pasted into the Firebase Console in your browser. No
terminal required.

1. **Firestore rules** — Console → **Build → Firestore Database → Rules**
   tab → delete what's there → paste the entire contents of `firestore.rules`
   → **Publish**.
2. **Storage rules** — Console → **Build → Storage → Rules** tab → same
   thing: paste `storage.rules` → **Publish**.
3. **Indexes** — you don't need to create these upfront. Just use the app
   once it's live: the first time a feed query needs a composite index that
   doesn't exist yet, Firestore throws an error in the browser console
   (press F12 → Console tab) that includes a direct link like
   `https://console.firebase.google.com/.../create_composite_index?...`.
   Click it → it opens the Console with every field pre-filled → click
   **Create**. It takes a couple of minutes to build. Do this once per query
   the first time you hit each tab (Following feed, Trending, a tag page,
   etc.) — after that it's instant for everyone.

## Step 4 — Get the code into GitHub (no `git push` from a PC)

Since you're pasting straight into GitHub's web interface rather than pushing
from a local machine, here's the browser-only way to do it:

1. On github.com, click **New repository** → name it (e.g. `folium`) →
   **Create repository**.
2. On the repo's main page, click **Add file → Upload files**.
3. Unzip `folium.zip` on your device first, then drag the **contents** of the
   folder (not the zip itself) into the upload box — `index.html`, `css/`,
   `js/`, `icons/`, all of it at once. Modern browsers preserve the folder
   structure when you drag a whole folder in. If your browser only accepts
   individual files (common on mobile), you'll need to create the subfolders
   manually — see the fallback below.
4. Scroll down, add a commit message like "Initial upload", click
   **Commit changes**.

**Fallback if drag-and-drop of folders doesn't work on your device:** use
**Add file → Create new file** instead of Upload. In the file name box, type
the full path including folders — e.g. typing `css/style.css` as the
filename automatically creates the `css` folder and puts the file inside it.
Paste the file's content in the editor below, commit. Repeat for each file
(`index.html`, `auth.html`, `write.html`, `post.html`, `profile.html`,
`explore.html`, `manifest.json`, `sw.js`, everything in `css/`, `js/`, and
`icons/`). It's more clicks but works entirely from a phone browser too.

## Step 5 — Turn the repo into a live site (GitHub Pages)

1. In your repo, go to **Settings → Pages**.
2. Under **Build and deployment → Source**, choose **Deploy from a branch**.
3. Branch: **main**, folder: **/ (root)** → **Save**.
4. Wait a minute, then refresh — GitHub shows the live URL at the top:
   `https://your-username.github.io/folium/`.

That's your whole hosting step — no CLI, no build, just static files GitHub
now serves directly. Any time you edit a file again through GitHub's web
editor and commit, the live site updates automatically within a minute or two.

**Note on the URL shape:** GitHub Pages serves a repo at a *subpath*
(`/folium/`), not your domain's root. The code here already uses relative
paths everywhere (`./sw.js`, `./index.html`, etc. in the manifest and service
worker) specifically so it works correctly at that subpath — you don't need
to change anything. If you later point a custom domain at it (like your
`futaoc.name.ng` setup), that also works unchanged.

**Alternative hosts** (also fully static, drag-and-drop friendly, no CLI):
Netlify and Vercel both let you drag a folder straight into their web
dashboard to deploy — worth knowing if you ever want an alternative to
GitHub Pages.

## Step 6 — Make it installable (PWA)

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

## Step 7 — Test it end to end

1. Open the deployed URL → **Create an account** (auth.html) — fill name,
   username, email, password.
2. Click **Write** → add a title, cover image, some formatted text, a tag or
   two → **Publish**.
3. Open the post → try **Like**, add a **comment**, hit **Share** (native
   share sheet on mobile, clipboard copy on desktop).
4. Visit another account's profile → **Follow** → check it shows up in your
   **Following** feed.
5. On your phone, confirm the **Install** flow from Step 6.

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
