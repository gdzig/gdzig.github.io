# gdzig.github.io

Source for the GDZig organization website at <https://gdzig.github.io/>.

The generated Zig API reference for `gdzig/gdzig` is published separately at <https://gdzig.github.io/gdzig/>.

## Analytics

The site sends pageviews to PostHog in cookieless mode. It does not capture clicks, theme changes, errors, or session recordings. PostHog's cookieless mode requires **Cookieless server hash mode** under **Project Settings → Web analytics**. Enable that setting before deploying this integration; otherwise PostHog ignores cookieless events.

For local builds, copy `.env.example` to `.env` and set the public project token and client API host. For GitHub Pages builds, set the same values as repository Actions variables named `PUBLIC_POSTHOG_PROJECT_TOKEN` and `PUBLIC_POSTHOG_HOST`. Both values appear in the generated HTML; the project token is not a secret. Production builds fail if either value is missing.

After deployment, open the home page and a docs page, then confirm `$pageview` events arrive in PostHog. Cookieless mode does not persist an identity across days, so unique visitor counts over longer periods are approximate.
