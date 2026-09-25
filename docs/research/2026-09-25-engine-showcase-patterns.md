# Research: Official Engine/Tool Showcase Patterns

**Date:** 2026-09-25
**Purpose:** Inform the design of a GDZig / Vector Wave showcase entry page on gdzig.github.io.

## Summary

Official engine showcases across Godot, Unity, Unreal, Defold, Bevy, Fyrox, and jMonkeyEngine follow a common pattern: a curated grid of project cards linking to individual detail pages. The most effective showcases (Godot, Defold) use structured, JSON-driven metadata, multiple image sizes for responsive layouts, developer testimonials, and clear eligibility criteria. The least effective (Bevy Assets, Fyrox) bury games within general asset directories or provide too little metadata. For a GDZig showcase, adopt the Defold JSON-data model plus Godot's individual-page depth, avoid Unity's marketing-heavy approach, and start with lower curation thresholds than Godot's 100-review minimum.

## Findings

### 1. Godot Engine Showcase — The Gold Standard for Structure

**Index page** (`godotengine.org/showcase/`): Grid of project cards organized into three tabs: **Games**, **Apps & Tools**, and **Coming Soon**. Platform filter buttons (Windows, Mac, Linux, Web, Android, iOS, PlayStation, Xbox, Nintendo Switch/Switch 2, VR). Each card shows a thumbnail, title, and short tagline. [Source](https://godotengine.org/showcase/)

**Individual project page structure:**
- **Title** + **Developer/Studio** + **Month/Year** (e.g., "by Blender Studio | July 2025")
- **Short description paragraph** including genre
- **Feature sections** with bold visual headers (e.g., "Explore," "Bound together," "Play your way") — each a short paragraph selling a key feature
- **Screenshot gallery** (5-6 images, clickable lightbox)
- **External store links** — Steam, itch.io, GOG, Nintendo eShop, Xbox, etc.
- **"Why the developer chose Godot"** — pull-quote testimonial, often linking to a full developer interview blog post
- **Metadata in page source**: Structured JSON-LD or inline data with title, developer, date, genre, platforms, links

Example entries studied: [DOGWALK](https://godotengine.org/showcase/dogwalk/), [Tiny Garden](https://godotengine.org/showcase/tiny-garden/), [The Garden Path](https://godotengine.org/showcase/the-garden-path/), [Ambidextro](https://godotengine.org/showcase/ambidextro/), [Primal Light](https://godotengine.org/showcase/primal-light/).

**Submission & eligibility** (`godotengine.org/showcase/submissions/`):
- Google Form with: game name, developer, release status, Godot version, content check, store pages, proof of traction (≥100 positive reviews or substitute evidence), reason for using Godot, contact email
- Eligibility: released or public demo, ≤12 months to release, Godot 4 preferred, polished, ≥100 positive reviews (or videos/articles/wishlists/media as substitute), active store page, all-audience-friendly content
- Godot Foundation collaborations exempted from strict criteria [Source](https://godotengine.org/showcase/submissions/)

**Annual showreels**: Video compilations on YouTube with community submissions, timecoded game list in description. [Source](https://www.youtube.com/watch?v=n1Lon_Q2T18)

### 2. Unity Made With Unity — Marketing-First, Documentary-Style

**Page structure** (`unity.com/made-with-unity`):
- Hero banner with stat: "3 billion players each month"
- **Summer Showcase video** (sizzle reel, ~1-2 min)
- **Featured Creators** — spotlight cards (3-4) linking to game case studies
- **Developer Stories** — editorial case-study articles with developer interviews (e.g., Esoteric Ebb, LEGO Voyagers, Cairn, V Rising, Dave the Diver)
- **"Submit your project"** CTA with form
- Monthly blog roundups: "Games Made With Unity — [Month] [Year] Releases"

**Key difference from Godot**: No structured metadata per game, no grid of all showcased games on the main page. Games appear only via feature spots and blog roundups. More like a magazine than a catalog. The "Games" URL (`unity.com/games`) exists but redirects to the same Made With Unity page. [Source](https://unity.com/made-with-unity)

**Unite Showcase**: Separate in-person event submission with official rules — requires playable Unity project, press kit, Made with Unity splash screen, in-person presentation at Unite conference. Not a web catalog. [Source](https://unity.com/legal/mwushowcaseofficialrules)

### 3. Unreal Engine — Fragmented Across Multiple Channels

No single unified showcase page. Instead:
- **Indie Games page** (`unrealengine.com/uses/indie-games`): Curated indie projects with developer resources
- **Student Showcase** (`unrealengine.com/events/student-showcase`): Annual academic project competition
- **Community Showcase forum** (`forums.unrealengine.com/c/community/showcase/154`): User-submitted forum threads, game-development subcategory
- **Spotlights** (e.g., "The Matrix Awakens," "Habitat 67"): Deep-dive behind-the-scenes technical articles
- **Sample Projects** (Stack O Bot, Lyra, Valley of the Ancient): Learning-oriented downloadable projects, not a game showcase
- **Event roundups**: Blog posts listing Unreal-powered games shown at Summer Game Fest, Xbox Showcase, etc. [Source](https://www.unrealengine.com/blog/over-40-unreal-engine-powered-games-highlighted-during-recent-summer-events)

**Takeaway**: Fragmenting the showcase across forums, spotlights, and event pages dilutes discoverability. A single unified catalog is superior for visitors browsing "what's been made with this tool."

### 4. Defold Showcase — JSON-Driven, GitHub-Native

**The most technically elegant approach for a small/medium ecosystem.**

**Data model** — Each game is a JSON file in `github.com/defold/games-showcase`:
```json
{
    "name": "Family Island",
    "description": "Short paragraph describing the game...",
    "url": "https://play.google.com/store/apps/details?id=...",
    "developer": "MoonActive",
    "publisher": "",
    "platforms": "iOS, Android",
    "releasedate": "2019",
    "downloads": "50M+ on Google Play (Sep 2025)",
    "showcase": "full",
    "images": {
        "full": "familyisland-full.webp",
        "half": "familyisland-half.webp",
        "third": "familyisland-third.webp"
    }
}
```

**Image sizes**: `full` (2000×750, hero card), `half` (1200×600, two-column grid), `third` (800×600, compact carousel). All WebP. [Source](https://github.com/defold/games-showcase)

**Submission**: GitHub Issue with pre-filled JSON template. PR-based updates. Defold team decides acceptance and placement. [Source](https://github.com/defold/games-showcase/issues/new?template=new-game.md)

**Page rendering**: Two URLs — `defold.com/showcase/` and `defold.com/games/` — both render same data but with different layouts. Flat grid, no filtering or search. Every entry gets: image, title, description paragraph, link to store. Mixes commercial games and open-source demos. [Source](https://defold.com/showcase/)

**Key weakness**: No platform/genre filters, no search, no individual detail pages — everything is a single scrolling grid. This works for ~40 entries but won't scale well.

### 5. Bevy Assets — Plugin Registry, Not a Game Showcase

`bevy.org/assets/` is primarily a community plugin/asset registry with games and tools appended at the bottom under "Apps → Games" and "Apps → Tools." The page is organized by feature category (2D, 3D, UI, Physics, etc.), making game discovery secondary. Submission via PR to `github.com/bevyengine/bevy-assets`. [Source](https://bevy.org/assets/)

**Bevy does have** a separate runnable examples page (`bevy.org/examples/`) with WebGL and WebGPU examples, but these are engine-feature demos, not community game showcases. [Source](https://bevy.org/examples/)

**Takeaway**: Do not bury games within a general asset/plugin directory. Games need their own dedicated, prominent showcase section.

### 6. Fyrox — Minimal List, Hard to Browse

`fyrox.rs/games.html` lists 6 community-made games with title, one-line description, and external link. No screenshots on the index, no filters, no individual pages. The accompanying `fyrox.rs/examples.html` has demo projects with screenshots. [Source](https://fyrox.rs/games.html)

**Takeaway**: A bare list of links without screenshots or rich metadata fails to inspire. Every showcase entry needs at minimum a compelling visual and a paragraph of context.

### 7. jMonkeyEngine — Card Grid with Badges, Individual Pages

`jmonkeyengine.org/showcase/` features: featured project at top, **26 games** and **44 tools & experiments** in separate tabs, card grid layout. Each card: external platform badge (Steam, IndieDB), title, creator, short description. Individual project pages at `/showcase/[slug]` show availability, links, full description, screenshots. [Source](https://jmonkeyengine.org/showcase/)

**Notable**: The platform-badge-on-card pattern makes external availability immediately visible without clicking through.

### 8. Zig Language — No Official Showcase

Zig has no official showcase page. The closest equivalents:
- `ziglang.org/learn/samples/` — code snippets for learning
- `github.com/zig-gamedev/zig-gamedev` — community dev repo with sample applications (PBR, bullet physics, audio)
- `github.com/zigcc/awesome-zig` — community-curated list on GitHub
- `github.com/zig-community/zig-showdown` — community game project

**Takeaway**: A language/tool without a showcase page leaves its ecosystem's achievements invisible. GDZig/Vector Wave should absolutely have a showcase to demonstrate ecosystem vitality.

## Cross-Cutting Patterns

### Patterns to Copy (Adopt for GDZig Showcase)

| Pattern | Source | Why |
|---|---|---|
| **JSON-driven data with GitHub submission** | Defold | Low-maintenance, PR-based, no CMS needed, easy to version |
| **Three responsive image sizes per entry** | Defold | Enables card grid, hero banner, and carousel layouts |
| **Structured metadata: name, developer, date, platforms, description, store links** | Defold, Godot | Machine-readable, enables filtering and search |
| **Individual detail pages per project** | Godot, jMonkeyEngine | Allows screenshots gallery, feature lists, developer story |
| **Developer testimonial ("Why GDZig?")** | Godot | Humanizes the entry, builds community narrative |
| **Feature-list sections on detail page** | Godot | Scannable selling points, good for SEO |
| **Platform filter tags on index** | Godot | Helps visitors find projects relevant to their target |
| **Separate tabs: Games vs Tools vs Coming Soon** | Godot, jMonkeyEngine | Clear organization for different project types |
| **External platform badges on cards** | jMonkeyEngine | Immediate availability signal (Steam, itch.io, web) |
| **Clear submission criteria with reasonable thresholds** | Godot (adapted) | Filters quality without gatekeeping small ecosystem |
| **Annual showreel video** | Godot, Unity | High-impact promotional content |
| **Curated selection with human review** | Godot, Defold | Prevents spam, maintains quality signal |

### Patterns to Avoid

| Anti-Pattern | Source | Why |
|---|---|---|
| **Marketing-heavy, no structured catalog** | Unity | Magazine-style without a browsable grid — poor discoverability |
| **Fragmenting showcase across forums + spotlights + event pages** | Unreal Engine | Visitors can't easily answer "what's been made with this?" |
| **Burying games within a general asset/plugin directory** | Bevy Assets | Games need dedicated, prominent placement |
| **Bare link list without screenshots or rich metadata** | Fyrox | Fails to inspire or inform — looks abandoned |
| **Single scrolling grid with no filters or search** | Defold | Doesn't scale beyond ~50 entries |
| **100+ review minimum for a young ecosystem** | Godot | Too high for GDZig/Vector Wave; use lower bar like "public demo available" |
| **In-person event as primary showcase channel** | Unity (Unite) | Irrelevant for a web-first, community-driven project |
| **Forum threads as primary submission method** | Unreal Engine community | Hard to curate, inconsistent metadata, no structured data |

## Specific GDZig/Vector Wave Showcase Recommendations

1. **Data model**: Adopt Defold's JSON-per-game model stored in the site repo. Include fields: `name`, `slug`, `description`, `url` (primary store/link), `developer`, `engine_version` (e.g., "GDZig 0.x" or "Zig 0.14"), `platforms` (comma-separated), `releasedate`, `tags` (genre, 2D/3D, open-source), `images` (hero, card, thumbnail), `featured` (boolean).

2. **Submission**: GitHub Issue template with pre-filled JSON. PR-based updates. Lower barrier than Godot — require only a public build/demo and a store page or project website. No review-count minimum for a young ecosystem.

3. **Index page**: Card grid with platform/genre filter tags, tabs for Games / Demos & Experiments / Tools, external-store badges on each card.

4. **Detail page per project**: Hero image, description, feature bullets, screenshot gallery, "Why GDZig/Vector Wave?" developer quote, external links, "built with" tags.

5. **First few entries**: Seed with 3-5 high-quality projects manually. Show the pattern, then accept community submissions.

## Sources

- Kept: Godot Showcase (https://godotengine.org/showcase/) — gold standard for structured game showcase
- Kept: DOGWALK – Godot Engine (https://godotengine.org/showcase/dogwalk/) — representative individual page structure
- Kept: Tiny Garden – Godot Engine (https://godotengine.org/showcase/tiny-garden/) — newer entry pattern
- Kept: The Garden Path – Godot Engine (https://godotengine.org/showcase/the-garden-path/) — includes "Why the developer chose Godot" testimonial
- Kept: Godot Showcase Submissions (https://godotengine.org/showcase/submissions/) — eligibility criteria and process
- Kept: Made With Unity (https://unity.com/made-with-unity) — marketing-first approach comparison
- Kept: Unreal Engine Indie Games (https://www.unrealengine.com/uses/indie-games) — fragmented showcase example
- Kept: Defold Games Showcase (https://defold.com/showcase/) — JSON-driven data model
- Kept: defold/games-showcase GitHub (https://github.com/defold/games-showcase) — exact JSON schema and submission template
- Kept: Bevy Assets (https://bevy.org/assets/) — counter-example of burying games in plugin registry
- Kept: Fyrox Games (https://fyrox.rs/games.html) — counter-example of minimal link list
- Kept: jMonkeyEngine Showcase (https://jmonkeyengine.org/showcase/) — card-grid with platform badges pattern
- Kept: Zig Samples (https://ziglang.org/learn/samples/) — confirms Zig has no official showcase
- Dropped: Reddit threads — secondary commentary, not primary sources
- Dropped: GamingOnLinux Godot showreel article — good coverage but secondary source
- Dropped: Wikipedia lists — tertiary encyclopedic content
- Dropped: Unity blog monthly roundups — too granular, pattern already clear from main page
- Dropped: YouTube showreel videos — confirmed existence, content not needed for structural analysis

## Gaps

- **Exact traffic/engagement metrics**: Could not find published data on how many visitors Godot or Defold showcase pages receive, or submission volume. This would help set expectations.
- **Unreal Engine indie page content**: Fetch failed with HTTP 403. The page structure is inferred from search results and URL naming but not confirmed through direct content inspection.
- **How Godot display logic maps to data storage**: The Godot showcase is powered by a custom PHP backend. The exact data schema (beyond what's visible in the rendered HTML and submission form) is not publicly documented.
- **GDZig Vector Wave current state**: Not investigated — what projects already exist that could be seeded as showcase entries? This would be a valuable follow-up before building the showcase page.