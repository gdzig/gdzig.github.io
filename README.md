# gdzig.github.io

Source for the GDZig organization website at <https://gdzig.github.io/>.

The generated Zig API reference for `gdzig/gdzig` is published separately at <https://gdzig.github.io/gdzig/>.

## Syndication

Blog posts are bridged to the fediverse, which covers Mastodon and other ActivityPub servers, as [@gdzig.github.io@web.brid.gy](https://fed.brid.gy/web/gdzig.github.io). Follow from Mastodon or any fediverse server with the remote-follow form at <https://fed.brid.gy/web/gdzig.github.io/followers>. Posts also bridge to Bluesky as [gdzig.github.io.web.brid.gy](https://bsky.app/profile/gdzig.github.io.web.brid.gy). The bridge is read-only: posts go out to those networks, but replies, likes, reposts, and follows do not come back to the site.

Bridgy collects interactions in a notifications feed at <https://fed.brid.gy/web/gdzig.github.io/notifications?format=rss>. Use it to review replies, likes, reposts, and new followers in one place.

The [Bridgy user page](https://fed.brid.gy/web/gdzig.github.io) reports bridge status and lets you update the profile after a deploy. Bridgy discovers posts from the feed linked on the home page and federates them on its next poll. It does not backfill posts older than about two weeks.

## Analytics

The site sends pageviews to PostHog in cookieless mode. It does not capture clicks, theme changes, errors, or session recordings. PostHog's cookieless mode requires **Cookieless server hash mode** under **Project Settings → Web analytics**. Enable that setting before deploying this integration; otherwise PostHog ignores cookieless events.

For local builds, copy `.env.example` to `.env` and set the public project token and client API host. For GitHub Pages builds, set the same values as repository Actions variables named `PUBLIC_POSTHOG_PROJECT_TOKEN` and `PUBLIC_POSTHOG_HOST`. Both values appear in the generated HTML; the project token is not a secret. Production builds fail if either value is missing.

After deployment, open the home page and a docs page, then confirm `$pageview` events arrive in PostHog. Cookieless mode does not persist an identity across days, so unique visitor counts over longer periods are approximate.
