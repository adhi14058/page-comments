# Deploying the site

The website at https://page-comments.heyadhi.com/ is the `site/` folder of this
repository's `main` branch. The release builds `site/` and pushes it. A timer
on the VPS fetches `main` every 90 seconds and puts the new `site/` live. There
is no CI job, no deploy key and no secret.

The old address, https://page-comments.share.heyadhi.com/, stays alive for the
bookmarks made before the move. It serves `/client.js` and `/version.svg` from
the same files, and answers every other path with a 308 to the new address.

## How it fits together

| Piece | Where on the VPS | What it does |
| --- | --- | --- |
| [`page-comments-pull`](page-comments-pull) | `/usr/local/sbin/` | fetches `main`, unpacks `site/` into a new release folder, swaps the `live` link in one rename |
| [`systemd/`](systemd) | `/etc/systemd/system/` | runs the puller every 90 s as the `page-comments` user, which may write only `/srv/page-comments` |
| `/srv/page-comments/` | owned by `page-comments`, mode 755 | `repo.git` (a bare, shallow fetch of `main`), `www/releases/<commit>/` (the last five), `www/live` → the live one |
| [`compose.yaml`](compose.yaml), [`caddy/Caddyfile`](caddy/Caddyfile) | `~/projects/page-comments/deploy` | the project's own pinned Caddy (uid 10012, no network), serving `www/live` read-only on both names |
| `/srv/sites/adhi/page-comments/` | owned by 10012, mode 710 | the socket the edge reaches the Caddy through |
| two domain registrations | `/srv/domains/` | `page-comments.heyadhi.com` and `page-comments.share.heyadhi.com`, each its own registration |

The edge setup that all of this follows is in `~/projects/edge/README.md` on
the VPS.

Caching: `client.js`, `version.svg`, the HTML pages and everything else answer
`Cache-Control: no-cache`, so a browser asks each time and gets a 304 when the
file is unchanged. Bookmarks see a new release at once, and a replaced picture
shows at once too.

A failed pull (GitHub down, no `site/`, `index.html`, `client.js` or
`version.svg` missing) changes nothing that is live. It fails the unit, and the
journal says why: `journalctl -u page-comments-pull`.

## Before the first install

1. `deploy/` is committed and pushed to `main`, because the VPS clones it.
2. A release has committed and pushed `site/` to `main`, because the first
   pull needs it.

## Install on the VPS, in this order

Every step is a change on the VPS, so run each one by hand and check it before
the next. Steps 1–9 make the new address live and leave the old one alone.
Step 10 moves the old address, and it comes last.

**1. The puller's user and folders.**

```bash
sudo useradd --system --home-dir /srv/page-comments --no-create-home \
  --shell /usr/sbin/nologin page-comments
sudo install -d -o page-comments -g page-comments -m 755 \
  /srv/page-comments /srv/page-comments/www /srv/page-comments/www/releases
sudo -u page-comments git init --quiet --bare /srv/page-comments/repo.git
```

Check: `ls -la /srv/page-comments` shows the three entries, owned by `page-comments`.

**2. The deploy files.** This is a clone of the public repository over HTTPS,
like every other project in `~/projects`.

```bash
timeout 120 git clone https://github.com/adhi14058/page-comments.git ~/projects/page-comments
```

**3. Install the puller and its units.**

```bash
cd ~/projects/page-comments/deploy
sudo install -m 0755 page-comments-pull /usr/local/sbin/
sudo install -m 0644 systemd/page-comments-pull.service systemd/page-comments-pull.timer /etc/systemd/system/
sudo systemctl daemon-reload
```

**4. Run one pull by hand.**

```bash
sudo timeout 200 systemctl start page-comments-pull.service
journalctl -u page-comments-pull -n 20 --no-pager
readlink /srv/page-comments/www/live
```

Check: the journal ends with `live: <commit>`, and that commit is
`git ls-remote https://github.com/adhi14058/page-comments.git main`.

**5. Start the timer.**

```bash
sudo systemctl enable --now page-comments-pull.timer
systemctl list-timers page-comments-pull.timer --no-pager
```

Check: NEXT is under 90 seconds away. A minute later, `systemctl status
page-comments-pull.service` shows a run that exited 0.

**6. The socket folder.** Create it as `adhi`, inside `adhi`'s owner folder, so
it inherits the edge's ACL. Never `chmod 700` it: that shuts the edge out.

```bash
mkdir -m 710 /srv/sites/adhi/page-comments
sudo chown 10012:10012 /srv/sites/adhi/page-comments
```

Check: `getfacl -p /srv/sites/adhi/page-comments` matches
`/srv/sites/adhi/heyadhi`: owner 10012, `user:10011:-wx`, effective `--x`.

**7. Start the Caddy.**

```bash
cd ~/projects/page-comments/deploy
sudo timeout 300 docker compose up -d
sudo docker compose ps
sudo docker compose logs --tail 20 caddy
```

Check: the container is running, and the log has no error. Two warnings are
expected, because a Unix socket has no HTTP/2 or HTTP/3.

**8. Test it the way the edge reaches it**, before any name points at it:

```bash
for h in page-comments.heyadhi.com page-comments.share.heyadhi.com; do
  for p in / /client.js /version.svg; do
    echo "== $h$p"
    sudo setpriv --reuid 10011 --regid 10011 --clear-groups timeout 10 curl -sSI \
      --unix-socket /srv/sites-edge/adhi/page-comments/caddy.sock -H "Host: $h" "http://x$p" \
      | grep -iE '^(HTTP|cache-control|content-type|location)'
  done
done
```

Expected: on the new name, all three answer 200 with `no-cache`. On the old
name, `/client.js` and `/version.svg` answer 200 with `no-cache`, and `/`
answers 308 with `Location: https://page-comments.heyadhi.com/`.

**9. Register the new name.** This is its own registration, so step 10 and any
rollback of it never touch this one.

```bash
domains register heyadhi.com --project page-comments --names page-comments.heyadhi.com
domains status page-comments.heyadhi.com
```

Check from anywhere:

```bash
timeout 10 curl -sSI https://page-comments.heyadhi.com/ | grep -iE '^(HTTP|cache-control|content-type)'
timeout 10 curl -sSI https://page-comments.heyadhi.com/client.js | grep -iE '^(HTTP|cache-control|content-type)'
```

Then open the site in a browser: the home page, the changelog page, and the
playground's Start button.

**10. Move the old name, last.** Release 1.10.0 is the first that no longer
uploads to the share site, so do this step soon after it is on `main`. Until
then, bookmarks made before the move load the last upload, 1.9.11: they work,
one release behind. First check that the new address serves the release on
`main`:

```bash
timeout 120 git -C ~/projects/page-comments pull --quiet
sha256sum ~/projects/page-comments/site/client.js
timeout 10 curl -s https://page-comments.heyadhi.com/client.js | sha256sum
```

The two sums must be equal. Then register the old name:

```bash
domains register share.heyadhi.com --project page-comments --names page-comments.share.heyadhi.com
domains status page-comments.share.heyadhi.com
```

Check:

```bash
timeout 10 curl -sSI https://page-comments.share.heyadhi.com/client.js | grep -iE '^(HTTP|cache-control|content-type)'
timeout 10 curl -sSI 'https://page-comments.share.heyadhi.com/version.svg?t=1' | grep -iE '^(HTTP|cache-control|content-type)'
timeout 10 curl -sSI 'https://page-comments.share.heyadhi.com/any/path?x=1' | grep -iE '^(HTTP|location)'
```

Expected: 200 and `no-cache` on both files, and 308 to
`https://page-comments.heyadhi.com/any/path?x=1`. Then click a bookmark made
before the move on any page. It must open the tool.

Once these checks pass, delete the share page `page-comments` on
share.heyadhi.com (`share delete page-comments`), so there is one copy of the
site. A rollback of step 10 then needs the page published again first (see
Rolling back).

## After the install

- **A new release:** nothing to do on the VPS. It is live within about 90
  seconds of the push.
- **A change to `deploy/caddy/` or `deploy/compose.yaml`:**
  `cd ~/projects/page-comments && git pull && cd deploy && sudo docker compose up -d && sudo docker compose exec caddy caddy reload --config /etc/caddy/Caddyfile`
- **A change to the puller or its units:** pull, then repeat step 3. The VPS
  never runs the puller from the fetched repository, so a commit cannot change
  what the puller does until someone installs it.
- **The edge moves its Caddy pin:** change the digest in `compose.yaml` with
  all the other sites.

## Rolling back

- **A bad release:** revert it on GitHub and push. The revert is live within
  about 90 seconds. To go back at once, stop the timer and point `live` at an
  earlier release:

  ```bash
  sudo systemctl stop page-comments-pull.timer
  ls -t /srv/page-comments/www/releases
  sudo -u page-comments ln -sfn releases/<earlier commit> /srv/page-comments/www/.live-new
  sudo -u page-comments mv -T /srv/page-comments/www/.live-new /srv/page-comments/www/live
  ```

  Start the timer again once `main` is fixed: `sudo systemctl start page-comments-pull.timer`.
- **Hand the old name back to the share page** (undoes step 10):
  `domains remove page-comments.share.heyadhi.com --yes`. The name then falls
  back to `_wild.share.heyadhi.com`. The share page was deleted at the switch,
  so publish it again first (`client.js`, `version.svg` and an `index.html`
  from the current `site/`, with the heyadhi-share CLI), or old bookmarks
  find nothing.
  **Type the full name.** `domains remove share.heyadhi.com` would take down
  every share page.
- **Take the new name down** (undoes step 9):
  `domains remove page-comments.heyadhi.com --yes`. The name then falls back to
  heyadhi's wildcard, which answers 404, as before the install. Never
  `domains remove heyadhi.com`.
- **Remove everything:** undo step 10 and step 9 first, then:

  ```bash
  sudo systemctl disable --now page-comments-pull.timer
  sudo rm /etc/systemd/system/page-comments-pull.{service,timer} /usr/local/sbin/page-comments-pull
  sudo systemctl daemon-reload
  cd ~/projects/page-comments/deploy && sudo docker compose down
  sudo rm -rf /srv/sites/adhi/page-comments /srv/page-comments
  sudo userdel page-comments
  ```
