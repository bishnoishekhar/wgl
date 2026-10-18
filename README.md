# Washington Gas mock site (demonstration)

A static, framework-free mock of the Washington Gas website (home, pay my bill, start or stop service, safety and outages, get assistance, ways to save, rebates and savings, home energy assessment, business owners, customer choice, damage claims, Spanish information, contact). It exists only to host a **chat and voice assistant** (Google CX Agent Studio web widget) in a realistic customer-facing context for a prototype demo.

> Demonstration site for a customer experience prototype. Not the official Washington Gas website.

There are no images (inline SVG and CSS only), no real logo, no JavaScript framework, and no backend. The only external resources are the Google Fonts stylesheet (Figtree, standing in for the licensed brand fonts) and the Google chat-messenger SDK files. All forms are non-functional.

## File map

```
index.html                  Home: utility bar, mega-menu header, hero + search, quick actions, gas safety alert,
                            promo cards, account tools, "Moving?" section, footer
pay-my-bill.html            Payment options, card convenience fee, walk-in offices, payment plans, AutoPay, eBill,
                            demo pay panel + "Prefer to talk it through? Pay with our assistant" button
start-stop-service.html     Notice, start/stop fees, Customer Choice, new service, demo request form
safety-and-outages.html     Signs of a leak, what to do, carbon monoxide, 811, outage information
get-assistance.html         Washington Gas Cares, programme status table (with valid-through dates), budget plan, payment plans
ways-to-save.html           Overview: rebates (MD / VA / D.C.), Rinnai offer, home energy assessment, contractors
rebates-and-savings.html    Detailed rebates: up to $800, Maryland (ends Dec 31, 2026, submit by Dec 1) and Virginia tables,
                            D.C. via DCSEU, Rinnai offer dates, contractors, Track My Rebate, financing, builders
home-energy-assessment.html What the online assessment is, how to start it (external Opower page), D.C. pending approval
business-owners.html        New gas service steps, added load or split meter, demolition and abandonment forms,
                            business energy solutions incentives, Maryland new construction table, commercial card fee
customer-choice.html        Eligibility (DC, MD, VA), what Washington Gas still does, billing options, questions to ask suppliers
damage-claims.html          How to file the online Damage Claim Form (on the official page), timelines, FAQs, what is not stated
espanol.html                Spanish landing page (emergency, pay a bill, start or stop service, assistance, safety, contact)
contact.html                Phone numbers, hours, mailing addresses, FAQs
404.html                    Not-found page (sets a <base> so links work from the GitHub Pages sub-path)
sitemap.xml                 Simple sitemap of the public pages (absolute URLs under https://bishnoishekhar.github.io/wgl/)
.nojekyll                   Tells GitHub Pages to serve files as-is
assets/css/site.css         All site styling (palette, header, mega menu, cards, forms, footer, placeholder launcher)
assets/css/widget-theme.css Restyles the CX Agent Studio widget (loaded AFTER the SDK stylesheets)
assets/js/site.js           Sticky header shrink, mega menu, mobile menu, hero search routing, demo forms
assets/js/assistant.js      Wires every [data-open-assistant] button to the widget; manages the placeholder launcher;
                            exposes window.wglPageContext (from <body data-page-context>)
assets/js/widget-embed.html SINGLE SOURCE for the widget snippet (head part + body part), documented
scripts/chrome.html         SINGLE SOURCE for the utility-bar links, main navigation (mega menu) and footer columns
scripts/build_pages.py      Stamps the widget snippet and the shared chrome into every page (python scripts/build_pages.py [--check])
README.md                   This file
```

All links and asset paths are relative (no leading `/`), so the site works at `https://bishnoishekhar.github.io/wgl/` and from any folder.

## Shared navigation and footer

The utility-bar links, the main navigation (mega menu) and the footer columns are no longer edited page by page. They live in `scripts/chrome.html` between `@@UTIL`, `@@NAV` and `@@FOOT` marker comments, and `scripts/build_pages.py` stamps them into every page (together with the widget snippet). To add a link: edit `scripts/chrome.html`, run `python scripts/build_pages.py`, and `python scripts/build_pages.py --check` should then print no `DIFFERS` lines. The script also adds `aria-current="page"` to the menu button of the section each page belongs to, using `<body data-page-context="...">`. A new page needs the five marker pairs (copy them from any page), a `data-page-context` value that exists in `MENU_FOR_CONTEXT` in the script, and an entry in `sitemap.xml`.

### Page context for the assistant

Every page has `<body data-page-context="...">`: `home`, `billing`, `service`, `safety`, `assistance`, `savings` (ways-to-save and rebates-and-savings), `business`, `choice`, `claims`, `energy`, `spanish`, `contact` (and `notfound` on 404.html). `assets/js/assistant.js` copies it to `window.wglPageContext`. It is also sent to the agent as the session variable `page_context` (see `docs/widget-contract.md`).

## The assistant widget

### How it is wired

`assets/js/widget-embed.html` holds the two parts of the snippet between marker comments. `scripts/build_pages.py` copies them into **every** page:

* **Head part** goes in `<head>` (between the `@@HEAD-START` / `@@HEAD-END` comments): the SDK script and the two SDK stylesheets (v1.16). `assets/css/widget-theme.css` is linked right after, so your variables win.
* **Body part** goes inside `<div id="assistant-slot">` at the end of `<body>` (between `@@BODY-START` / `@@BODY-END`): the `chatSdk.registerContext(...)` script with the deployment name and token broker setting, and the `<chat-messenger>` element.

Every "Ask our assistant" / "Pay with our assistant" element carries `data-open-assistant`. `assistant.js` opens the widget by setting the bubble's `expanded` property (falling back to clicking the launcher, retrying for a few seconds while the SDK loads). If there is no widget at all, a bottom-right "Chat or call with us" placeholder button (brand blue, gold ring, chat + phone icons) pulses and explains. The placeholder hides itself as soon as the `<chat-messenger>` custom element is defined.

The page layout reserves bottom space in the footer (`--fab-space`) so the floating launcher never covers footer links, including on mobile.

### Pasting a new or changed embed snippet

1. Open `assets/js/widget-embed.html`.
2. Replace only what is between `@@HEAD-START ... @@HEAD-END` (head part) and `@@BODY-START ... @@BODY-END` (body part). Keep the marker comments.
3. Run `python scripts/build_pages.py` (use `--check` to verify without writing).
4. Reload the site. Clear site data once if the chat remembers an old session.

### Changes made to the snippet supplied by the owner

* The supplied snippet used a bare `<chat-messenger-container>`. In SDK v1.16 that renders **inline** in the page flow (in testing there was no launcher, and on phones the chat filled the screen on load). The floating widget is `<chat-messenger-chat-bubble>`, which contains the launcher button **and** its own chat window, and forwards the container attributes. So the attributes and the three titlebar buttons now sit on/inside the bubble and the separate container was removed.
* `chat-title="Washington Gas Assistant"`; `chat-title-icon` is an inline data-URI SVG of the flame mark (no image file).
* `align-bottom-right` docks the chat window bottom right; `allow-fullscreen="small"` makes it full screen under 600px wide.
* Kept: `url-allowlist="*"`, `enable-file-upload`, `enable-audio-input`, and the reset / expand-collapse / close titlebar buttons.

### Widget attributes learned (SDK v1.16)

* On `<chat-messenger>`: `url-allowlist`, `service`, `logging-level`, `render-mode` (`slide-in` or `slide-over`, needs the layout CSS), `language-code`, `max-query-length`.
* On `<chat-messenger-chat-bubble>` (and the inline `<chat-messenger-container>`): `chat-title`, `chat-subtitle`, `chat-title-icon`, `chat-title-icon-alt`, `enable-file-upload`, `enable-audio-input`, `enable-audio-input-only`, `start-with-recording`, `placeholder-text`, `bot-writing-image`, `send-button-position`, `bot-actor-image`, `user-actor-image`.
* Bubble only: `expanded` (boolean property, `bubble.expanded = true` opens the chat), `align-bottom-right`, `hv-center`, `allow-fullscreen` (`small` or `always`), `chat-width`, `chat-height`, `chat-entry-point-button-display-style`, `chat-entry-point-button-text`, `chat-entry-point-button-icon`, `suppress-restore-on-load`, `hide-entry-toggle`.
* **Voice:** there is no separate "call" attribute. Voice is `enable-audio-input` (adds a microphone button beside the text box; enabled here), `enable-audio-input-only` (voice-only window) and `start-with-recording` (starts recording straight away, needs voice-only). The "chat, call or mixed" experience type is chosen when the web widget channel is created in Agent Studio (Deploy), not in the page markup. Check that choice in the channel if the microphone button does not appear.
* Events on `<chat-messenger>`: `chat-messenger-loaded`, `chat-messenger-close`, `chat-messenger-error`.

### Theming (`assets/css/widget-theme.css`)

Only variables the SDK actually reads are used (checked against `chat-messenger-default.css`, the Agent Studio docs and the SDK bundle). Public tokens are documented; `--chat-messenger-internal-*` ones are not documented but are read by the widget with `var(--x, fallback)`, so they work, and the SDK URLs pin v1.16 so they will not change underneath you.

| Area | Variable | Value |
| --- | --- | --- |
| Font | `--chat-messenger-font-family` | Figtree, Inter, system-ui |
| Surfaces | `--chat-messenger-color--surface`, `--surface-container` | `#ffffff` |
| Input fill | `--chat-messenger-color--surface-container-high` | `#f3fafe` |
| Primary | `--chat-messenger-color--primary` / `--on-primary` | `#0072bc` / `#ffffff` (5.1:1) |
| User bubbles | `--chat-messenger-color--primary-container` / `--on-primary-container`, `--chat-messenger-internal-message-user-background` / `-font-color` | `#0072bc` / `#ffffff` |
| Send button | `--chat-messenger-color--secondary` / `--on-secondary`, `--chat-messenger-internal-send-icon-background` / `-color` | `#ffc72c` / `#002a5c` (9.1:1) |
| Text | `--chat-messenger-color--on-surface` / `--on-surface-variant` | `#002a5c` / `#495057` |
| Links | `--chat-messenger-color--link` / `--link-hover` | `#00589a` / `#002a5c` |
| Borders | `--chat-messenger-color--outline` / `--outline-active`, `--chat-messenger-internal-input-box-border` | `#ced4da` / `#0072bc` |
| Corners | `--chat-messenger-shape--corner-value-small / -medium / -large / -extra-large`, `--chat-messenger-internal-chat-border-radius`, `-message-border-radius`, `-input-box-border-radius`, `-chips-border-radius`, `-button-border-radius` | 8px / 12px / 12px / 12px, and 12px for the internals |
| Shadow | `--chat-messenger-elevation` | navy-tinted |
| Title bar | `--chat-messenger-internal-titlebar-background`, `-font-color`, `-subtitle-font-color`, `-border-bottom`, `-padding`, `-icon-font-color`, `-title-font-weight` | `#002a5c`, `#ffffff`, `#c0ecff`, `4px solid #ffc72c`, 14px 16px, `#ffffff`, 700 |
| Title bar buttons | `--chat-messenger-internal-titlebar-button-background` / `-color` / `-color-hover` / `-background-hover` | transparent / `#ffffff` / `#ffffff` / white 16% (plus `--chat-messenger-color--on-surface-variant: #fff` scoped to the three slotted button elements) |
| Agent bubbles | `--chat-messenger-internal-message-bot-background` / `-font-color` / `-border` | `#f3fafe` / `#002a5c` / `1px solid #c0ecff` |
| Bubble corners | `-message-bot-border-top-left-radius`, `-message-user-border-top-right-radius` | 2px |
| Input text | `--chat-messenger-internal-input-font-color` / `-placeholder-font-color` | `#212529` / `#6c757d` |
| Focus ring | `--chat-messenger-internal-focus-color` / `-focus-color-contrast` | gold `#ffc72c` outer, navy `#002a5c` inner |
| Launcher | `--chat-messenger-internal-chat-bubble-background` / `-icon-color` / `-border` / `-size` | `#0072bc` / `#ffffff` / `3px solid #ffc72c` / 60px |
| Position | `--chat-messenger-internal-chat-window-offset`, plus a `position: fixed; right/bottom: 24px` rule on `chat-messenger-chat-bubble` (16px under 520px wide) | 24px |
| Window size | `--chat-messenger-internal-chat-window-width` / `-height` | 400px / `min(680px, 100vh - 48px)` |
| Stacking | `--chat-messenger-entry-point-button-z-index` | 999 |

The SDK leaves launcher placement to the host page, which is why the launcher has its own fixed-position rule; the chat window is positioned by the SDK via `align-bottom-right`.

### Chat cards, page context and the preview page

* `assets/js/assistant.js` writes `{page_context}` into sessionStorage `chat-messenger-variables` before the widget opens (and again on session events) and defines the `<wgl-card>` custom element. Card tools (usage history, bill trend, weather vs usage, bill breakdown, insights carousel, rebates, claim status, receipt, bill summary, quick actions, slot picker, appointment confirmation, emergency, CSAT) are rendered inside the chat through the SDK's `custom_template` rich element. The agent-side payloads, the SDK findings and what is unverified live are in `docs/widget-contract.md`.
* `createContext` now has `enableWelcomeEvent: true`, so the agent greets first (the agent must handle the `welcome` event).
* `widget-preview.html` (not linked, not stamped by `build_pages.py`) renders every card with sample data and no SDK: open it via `python -m http.server 8000`, then http://localhost:8000/widget-preview.html. Card buttons show the message they would send.

### Token broker and allowed origins

The widget runs with the token broker enabled (`enableTokenBroker: true`). The page's **origin** must be allowed in the channel settings (Agent Studio, Deploy, the web widget channel):

* `https://bishnoishekhar.github.io` (GitHub Pages)
* `http://localhost:8000` (local testing)

If the widget shows a 400 error or does not open, check that first. The `reCAPTCHA` option is off in this snippet.

### Identification limitation

The widget cannot pass the caller's phone number or a login to the agent: the page has no real sign-in (the "My Account" and "Log in" controls are demo-only). The assistant therefore treats every site visitor as a **guest** and asks for the mobile number on the account to look it up. Do not describe the demo as an authenticated experience.

## Test locally

```
cd path\to\wgl
python -m http.server 8000
```

Open http://localhost:8000/ (the origin above must be allowed for the widget to connect). Opening files directly with `file://` shows the site but not a working widget.

## Publish with GitHub Pages

1. Push the files to https://github.com/bishnoishekhar/wgl (below).
2. In the repository: **Settings, Pages**.
3. **Source:** Deploy from a branch. **Branch:** `main`, folder `/ (root)`. Save.
4. After a minute the site is at https://bishnoishekhar.github.io/wgl/ . Add that origin to the widget channel (see above).

## Commit and push (run these yourself, nothing has been committed)

```
cd path\to\wgl
git status
git add .
git commit -m "Add Washington Gas mock site with assistant widget integration"
git branch -M main
git remote add origin https://github.com/bishnoishekhar/wgl.git
git push -u origin main
```

If `origin` already exists, skip the `git remote add` line (or use `git remote set-url origin https://github.com/bishnoishekhar/wgl.git`).

## Where the content comes from

Facts (numbers, fees, hours, programme dates) come only from the Washington Gas website as captured in the project's `seed/data/knowledge_base.json` (articles with `verified_source: website`, read on October 17, 2026). Closed programme windows are shown as closed with their valid-through dates; where the real site is inconsistent (for example the notice period for moving, the customer service hours, or whether the card fee applies outside D.C.) the page says so rather than choosing. Programme windows have no years on the real site; re-check before a demo that falls after those dates. Nothing was invented. The mock is not the official site and must not be used to take real payments or requests.

## Design notes

Palette from the real site's stylesheet: navy `#002a5c`, brand blue `#0072bc`, primary blue `#245ea4`, light blue `#5fc6ff`, aqua `#c0ecff`, pale `#f3fafe`, gold `#ffc72c`, green `#4eaf6b`, red `#e62419`, and the grey scale `#f8f9fa` to `#212529`. Typeface: Figtree. Header shrinks on scroll; the main menu is a mega menu on desktop and a hamburger accordion on mobile. The pages share the same header, footer and snippet and are plain HTML files; the header menu and footer are stamped from `scripts/chrome.html` (see above).

The six later pages (rebates and savings, home energy assessment, business owners, customer choice, damage claims, Spanish) use content read on the live washingtongas.com pages and wgsmartsavings.com on October 17, 2026, plus the knowledge base. Spanish wording on `espanol.html` follows the real site's /espanol pages where they cover the fact; elsewhere it is a plain-Spanish translation of the same facts, numbers unchanged. Where pages of the real site disagree (card fee, notice period, D.C. RES discount months, 1.5 MBTU contact route, Spanish versus English card fee), the page says so.
