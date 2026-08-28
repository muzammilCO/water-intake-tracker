# Hydra 💧 — Water Tracker

A polished, local-first water tracker for GitHub Pages with phone reminders from GitHub Actions + ntfy — now with optional **cross-device sync using a private GitHub repository as the storage layer**.

## What you get

- Beautiful mobile-first dashboard
- Daily water target
- +250 / +500 / +750 ml quick logging
- Custom amount
- Undo last entry
- Daily history
- 7-day chart
- 7-day average
- Best day
- Goal-day count
- Current target streak
- JSON backup/restore
- GitHub Pages deployment
- Scheduled ntfy push reminders
- **Fetch history from GitHub on any device**
- **Sync & merge across phone/laptop/tablet**
- No conventional database
- No application server
- No analytics

## Architecture

```text
                  ┌───────────────────┐
                  │   GitHub Pages    │
                  │      Hydra        │
                  └─────────┬─────────┘
                            │
                 localStorage (device)
                            │
                    Sync & Merge
                            │
                            ▼
                ┌─────────────────────┐
                │ Private GitHub repo │
                │ data/water-data.json│
                └─────────────────────┘

GitHub Actions ───────→ ntfy ───────→ 📱
      schedule           push
```

GitHub's repository Contents API supports creating/updating files, including with fine-grained personal access tokens that have the repository Contents permission. The update operation uses the file SHA to replace an existing file. citeturn198681search0turn198681search1

## Important security choice

A static GitHub Pages app cannot keep a GitHub write credential secret. Hydra therefore **does not contain a token in the source code**.

Instead, every device where you want syncing enabled has its own locally stored token/session. Use a **fine-grained personal access token** limited to only the private Hydra repository, with:

```text
Repository access:
  Only selected repositories
    → hydra-water-tracker

Repository permissions:
  Contents → Read and write
```

Do NOT grant Actions/Workflows permission. The GitHub Contents API documentation says fine-grained tokens can use the endpoint with Contents: write; modifying `.github/workflows` would require the Workflows permission, which Hydra does not need. citeturn198681search0

## 1. Create the repository

Create a private repository, for example:

```text
hydra-water-tracker
```

Upload this project to the repository.

Expected structure:

```text
hydra-water-tracker/
├── index.html
├── app.js
├── styles.css
├── manifest.webmanifest
├── README.md
└── .github/
    └── workflows/
        ├── deploy.yml
        └── water-reminders.yml
```

The `data/water-data.json` file does not need to exist initially. Hydra will create it the first time you run **Sync & merge**.

## 2. Enable GitHub Pages

Open:

**Repository → Settings → Pages**

Under **Build and deployment** choose:

**Source → GitHub Actions**

The included `deploy.yml` publishes the static site.

## 3. Set up ntfy

Install ntfy on your phone.

Create a long random topic name, for example:

```text
hydra-83k29x-water-7f91m2
```

Subscribe to that topic in the app.

Keep the topic private because anyone who knows it can publish/subscribe according to the topic's access model.

## 4. Add the notification secret

Open:

**Repository → Settings → Secrets and variables → Actions → New repository secret**

Name:

```text
NTFY_TOPIC
```

Value:

```text
your-private-topic
```

Do not put this value in `index.html`.

## 5. Create the GitHub sync token

Open GitHub token settings and create a **Fine-grained personal access token**.

Use:

```text
Token name:
  Hydra Water Tracker

Expiration:
  Choose a period you are comfortable rotating

Resource owner:
  Your GitHub account

Repository access:
  Only select repositories
    → hydra-water-tracker

Repository permissions:
  Contents → Read and write
```

Do not grant extra permissions.

GitHub's documentation explicitly supports fine-grained tokens for the repository Contents endpoint. citeturn198681search0turn198681search1

## 6. Open Hydra on your first device

Open the deployed GitHub Pages URL.

Tap:

**☁ Sync**

Enter:

```text
GitHub owner:
  YOUR_GITHUB_USERNAME

Repository:
  hydra-water-tracker

Branch:
  main

Data file:
  data/water-data.json

Fine-grained GitHub token:
  github_pat_...
```

You can choose **Remember token on this device**.

Then tap:

**Sync & merge**

Hydra will:

1. Fetch the shared file if it exists.
2. Merge it with the device's local entries.
3. Write the combined history back to GitHub.
4. Keep the merged history locally.

The result is a shared source of truth.

## 7. Use it on another device

Open Hydra on your phone/laptop/tablet.

Tap:

**☁ Sync**

Enter the same:

- GitHub owner
- repository
- branch
- data file
- fine-grained token

Then tap:

**Fetch history**

The remote history becomes the device's local history.

For normal use, prefer:

**Sync & merge**

because it both downloads other-device entries and uploads this device's new entries.

## 8. How conflicts are handled

Every water entry has a unique ID.

For example:

```json
{
  "id": "4f7c...",
  "amount": 500,
  "at": "2026-08-29T08:12:31.000Z"
}
```

So if your phone records 500 ml and your laptop records 250 ml before either device syncs:

```text
Phone
  500 ml ─┐
          ├── merge ──→ GitHub
Laptop    │
  250 ml ─┘
```

both entries are retained.

Hydra also handles the common concurrent-update case where another device changes the GitHub file between fetch and write: it refetches, merges again, and retries.

## 9. Local storage vs GitHub storage

There are now two layers:

### Local

Fast, private device cache:

```text
browser localStorage
```

### Shared

Cross-device source of truth:

```text
private GitHub repository
└── data/
    └── water-data.json
```

Your GitHub file contains only hydration history/settings needed for sync. It does not contain your GitHub token.

## 10. Why this is not an "external database"

GitHub itself is the persistent storage layer.

You don't need:

- Firebase
- Supabase
- MongoDB
- PostgreSQL
- a VPS
- Cloudflare Workers
- a custom backend

GitHub stores the JSON file and gives us version history through normal commits.

This is a particularly good fit for this small personal application because the dataset is tiny.

## 11. Data format

The shared file looks like:

```json
{
  "app": "Hydra Water Tracker",
  "schemaVersion": 2,
  "updatedAt": "2026-08-29T02:00:00.000Z",
  "entries": {
    "2026-08-29": [
      {
        "id": "a1b2c3",
        "amount": 500,
        "at": "2026-08-29T08:12:31.000Z"
      },
      {
        "id": "d4e5f6",
        "amount": 250,
        "at": "2026-08-29T10:18:05.000Z"
      }
    ]
  }
}
```

Daily totals, weekly averages, streaks and charts are derived from these records.

## 12. Should the token be remembered?

The app gives you a choice.

### Off

Token exists only in the current page session. You will need to enter it again later.

### On

Token is stored in that browser's local storage, so Sync works without repeatedly pasting it.

GitHub recommends caution with tokens in client-side applications because browser-based clients cannot protect credentials as well as a server can. citeturn198681search3

For a private, personal deployment, the safest approach is to keep the repository narrowly scoped and use a fine-grained token with the minimum required permission.

## 13. Reminder schedule

The included workflow sends notifications at:

```text
08:07
10:07
12:07
14:07
16:07
18:07
20:07
```

India time:

```text
Asia/Kolkata
```

You can change these in:

```text
.github/workflows/water-reminders.yml
```

## 14. Backup still exists

Even with GitHub sync, keep the built-in:

**Backup / Restore → Export JSON**

It's useful for an independent copy of your history.

## 15. What "Fetch history" and "Sync & merge" mean

**Fetch history**

Replaces the current local history with the shared GitHub history.

Use this on a new device.

**Sync & merge**

The recommended button.

It:

```text
Local
   +
GitHub
   ↓
merge
   ↓
GitHub
   +
Local
```

No local entry is deliberately discarded just because another device was used.

## 16. What this does NOT do

Hydra does not make GitHub Actions read your hydration history.

The two systems remain separate:

```text
Hydration data
  browser ↔ GitHub repo

Notifications
  GitHub Actions → ntfy → phone
```

That keeps the architecture simple.

## 17. Why not put a GitHub PAT in the website?

Never do this:

```javascript
const token = "github_pat_...";
```

Anyone who can view the site/source can recover it.

Hydra requires you to supply the credential locally instead.

## 18. Rotation / revocation

Because the sync token is a GitHub token, you can revoke it from GitHub at any time and create a new one.

This also means a lost phone does not require changing the whole project: revoke the token and issue a replacement.

## 19. Final setup checklist

```text
[ ] Create private hydra-water-tracker repo
[ ] Upload Hydra files
[ ] Enable GitHub Pages via Actions
[ ] Install ntfy on phone
[ ] Create random ntfy topic
[ ] Add NTFY_TOPIC GitHub secret
[ ] Create fine-grained GitHub token
[ ] Give token only hydra repo + Contents Read/Write
[ ] Open Hydra
[ ] Tap Sync
[ ] Enter GitHub details + token
[ ] Tap Sync & merge
[ ] Add 500 ml
[ ] Sync again
[ ] Open Hydra on another device
[ ] Tap Sync → Fetch history
```

Then both devices have the same hydration history.

## One practical note

GitHub commits every successful update to the JSON file. For a personal tracker with a handful of water entries per day, this is small and manageable. If you eventually turn Hydra into a high-frequency app with thousands of events, I would change the storage architecture. For a personal water tracker, GitHub is an appropriate lightweight persistence layer.
