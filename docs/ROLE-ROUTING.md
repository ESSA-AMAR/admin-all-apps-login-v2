# One domain, every role: how sign-in routes people to their apps

Everybody uses **app.caissemanager.com**. A person signs in once, and the hub decides where they land. That decision comes from four things:

```
Identity ──► Role ──► Scope ──► Subscriptions ──► Route
 who         what      which part     what the holding      hub, a single app,
             they do   of the tree    pays for              or a store choice
```

## 1. Principles

1. **Nobody picks from a list of one.** One holding, brand, store or app means that step is skipped.
2. **Front-line staff never see the hub.** A cashier signs in and is at the till. A cook signs in and is on the KDS.
3. **Screens are paired, not signed in.** Unattended devices hold a device token, so they never need a password.
4. **The hub shows what you can open.** Admins also see locked apps, so they can add them. Everyone else sees only what they can use.
5. **Sign in once.** Opening any app reuses the hub session, so there is no second login.

## 2. URL map (single domain, path-based)

| Path | What |
| --- | --- |
| `/` | Sign-in, as on the POS: pick your profile, then PIN (staff) or password (office); admins can tap a badge |
| `/hub` | Launchpad: apps, Command Center, integrations |
| `/command` | Command Center: hierarchy explorer + consolidated dashboards |
| `/{app}/{target}` | An app opened on a store / brand / holding, e.g. `/pos/cmh-crusty-bru-1`, `/web-app/cmh-crusty` |
| `/pair` | Shown on a new screen: displays a 6-character pairing code |

Deep links survive sign-in. Opening `/kds/cmh-panda-bru-1` while signed out leads to sign-in, then straight back to that URL.

## 3. Roles

| Role | Signs in with | Lands on | Sees |
| --- | --- | --- | --- |
| Super Admin | Email | Launchpad, all holdings | All 17 apps (locked ones with a lock), integrations, Command Center |
| Holding Admin | Email | Launchpad, their holding | Same as above, one holding |
| Brand Manager | Email | Launchpad, pinned to the brand | Web App, Mobile App, Table QR, Screen Menu, Kiosk, Stock, Kitchen Monitoring |
| Regional Manager | Email | Launchpad, data limited to their countries | Stock, Attendance, Kitchen Monitoring, Screen Menu, Customer Display, Kiosk, POS |
| Store Manager | Email | Launchpad, pinned to the store | All store apps of their plan |
| Cashier | PIN | **POS Pro** (or POS if POS Pro isn't subscribed) | Only that app |
| Waiter | PIN | **POS Mobile** | Only that app |
| Kitchen Post | PIN | **KDS** | Only that app |
| Driver | PIN | **Delivery App** | Only that app |
| Employee | PIN | **Attendance App** | Only that app |

A front-line user who works in several stores gets one question, *"Where are you working today?"*, and then the app opens.

**Scope** is set by the assignment on the user: holdings, and optionally brands, countries or stores. Everything (Command Center, consolidated KPIs, app targets) is filtered by it before it reaches the screen.

## 4. The routing rule

```
on sign-in:
  holdings = user's holdings, narrowed by their assignment
  apps     = role apps; each is "open" if one of those holdings subscribes, otherwise "locked"
  if role is front-line (PIN):
      app = first open app in the role's preference order
      targets = stores where that app is subscribed
      1 target → open the app      | several → "Where are you working today?"
  else:
      open the Launchpad, auto-descending holding → industry → brand → … while there is one option
on launching an app from the Launchpad:
  targets = nodes in the current scope where the app is subscribed (stores, brands or holdings, by app level)
  1 target → launch | several → picker | 0 → the card is locked: "Request access"
```

## 5. App catalog: kind and level

The **level** sets what an app opens on. The **kind** sets how it starts.

| App | Kind | Opens on |
| --- | --- | --- |
| POS, POS Pro, POS Mobile | Staff | Store |
| KDS | Staff | Store |
| Delivery App | Staff (driver) | Store |
| Kitchen Monitoring | Back office | Store |
| Customer Display, Drive Thru, Screen Menu Display, Kiosk, Customer Queuing, QR Ringer | **Paired screen** | Store |
| Table QR, Web App, Mobile App | Back office | Brand |
| Gestion de Stock | Back office | Brand |
| Attendance App | Back office | Holding |

**Paired screens.** "Open" on a device app starts pairing. The screen shows a code at `/pair`, a manager types it in, and the screen is bound to the store with a long-lived device token. It reboots straight into its app.

## 6. Launchpad layout

1. **Header**: greeting, role badge, and the **scope pill** (click it to change scope through the Explore map).
2. **Toolbar**: ⌘K search (Enter opens the first match) and category tabs: Point of sale · Kitchen · Customer screens · Ordering channels · Operations.
3. **Command Center card**: live revenue and stores online for the scope, with Explore and Consolidated buttons.
4. **App sections** by category. Each card shows its icon, name, purpose, how many stores/brands it runs on, and its kind.
   - Open: hovering lights the card; clicking flies the icon into the launch sequence.
   - Locked: lock badge, hatched card, "Request access". The request goes to the account manager with the scope attached.
5. **Integrations** (admins): grouped as Delivery platforms (Glovo, Glovo On Demand, Yassir, Fantastic, KOOL), Payments (TPE intégré CMI, PSP CMI, Glory), CRM (Odoo), Calling systems (Syscall) and Scales (Brehm). Each is marked Connected or Available.

The top bar switches between **Apps · Explore · Consolidated**. Roles without the Command Center only see Apps.

## 7. What the backend must return at sign-in

```ts
Session {
  user: { id, name, role, title, assignment: { holdingIds, brandIds?, countryIds?, storeIds? } }
  holdings: Holding[]          // already narrowed to the assignment
  apps: { app, status: 'open' | 'locked', coverage }[]
  route: { kind: 'hub' } | { kind: 'direct', appId, targets: string[] }
  token: string                // SSO token every app accepts on this domain
}
```

The mock in `src/services/` (`api.ts`, `access.ts`) produces exactly this. Replacing it with the real endpoint leaves the UI unchanged.

## 8. Open decisions

- **PIN uniqueness.** The POS checks a PIN against the profile picked on the carousel, so PINs don't need to be unique (the POS demo staff all use `1234`). A badge or NFC card is looked up on its own and must be unique.
- **POS hand-off.** The hub opens the POS with `?staff=<first name>` and the POS trusts it. A real build needs a signed, short-lived token instead, checked by the POS backend.
- **Subscription granularity.** The prototype subscribes per holding. If plans are bought per brand or per store, `isSubscribed()` changes in one place.
- **Locked apps for managers.** Currently hidden for non-admins. Showing them locked could drive upsell, but it adds noise for staff.
- **App list vs design-system register.** The 17 apps here follow the product list. The design-system register (`design-system/reference/README.md`) lists a different 17 (e.g. Host App, Reservation, E-commerce; no POS Pro, Table QR or QR Ringer). Align the two.
- **Attendance pricing.** The product list notes "1–50 · Monthly 375 · Déploiement". Plans and prices aren't shown in the hub yet.
