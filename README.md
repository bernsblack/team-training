# Team Training

One-file mobile web app for the 60 minute team session: phase timers, relay
legs, banked reps, shuttle times and a scoreboard. State lives in
`localStorage`, so a locked phone or a reload continues where it left off.

Optional: a room code syncs the session across phones through Supabase.

## Local mode

Open `index.html`. That is all. No build, no server.

## Rooms (multi-phone)

One phone runs the clock and the phases. Each team counts its own reps on
its own phone. Every phone shows the same timer, counts and scores.

### 1. Supabase project

1. Create a free project at <https://supabase.com>.
2. SQL Editor → paste `supabase.sql` → Run.
3. Project Settings → API → copy the **Project URL** and the **anon public** key.
4. Put both into the top of the `<script>` block in `index.html`:

   ```js
   const SUPABASE_URL='https://xxxx.supabase.co';
   const SUPABASE_KEY='eyJ...';
   ```

A free project pauses after 7 days without activity. Open the dashboard the
day before the session and restore it if needed.

### 2. Host the page

Phones need a URL, not a file. Any static host works. GitHub Pages:

1. Push this folder to a GitHub repo.
2. Settings → Pages → Source: `main`, folder `/`.
3. The page is at `https://<user>.github.io/<repo>/`.

### 3. On the field

1. Host phone: tap **Create room**. Keep **Runs the clock** ticked, and tick
   the team this phone counts for.
2. Other phones: open the share link, or tap the room pill and enter the
   4-letter code. Tick the team that phone counts for.
3. If 2 phones claim the same team, the newest claim wins. The other phone
   sees "Another phone took over ..." and drops to view mode for that team.

## How sync works

State is split into 3 slices, each owned by at most one phone:

| Slice   | Contents                                        |
|---------|-------------------------------------------------|
| `host`  | phase, timers, team names, checklists, resets   |
| `team0` | team 0 legs, reps, finish time, home time       |
| `team1` | team 1 legs, reps, finish time, home time       |

A phone writes only the slices it owns and applies the others as they
arrive. Timers store an absolute start time, so every phone computes the
same countdown. Reset buttons on the host bump a counter; team phones see
the bump and clear their own slice.

## Tests

```sh
npm install --no-save jsdom@24
node test/local.test.mjs   # local mode, 32 checks
node test/room.test.mjs    # 2 phones on a stub server, 35 checks
```
