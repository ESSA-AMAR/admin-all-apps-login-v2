> **Version 2.** A copy of `admin-all-apps-login` to iterate on. It runs on port **5174** (`npm run dev`), so it can run next to the original on 5173.

# Caisse Manager · Command Center

Admin gateway for the Caisse Manager app ecosystem. This first iteration covers the login → store workflow:

```
Login ─► Holding ─► Industry ─► Brand ─► Country ─► City ─► Store
          (skipped if only one)  (skipped if the industry has only one brand)
```

The top bar has two modes:

- **Explore** steps down the path above. Every picker shows a consolidated strip for the scope you are in, e.g. all of Hospitality while you choose between Crusty and Panda.
- **Consolidated** opens the dashboard of the current scope: group, holding, industry, brand, country, city or store. Each dashboard breaks down by the next level (holding → industries → brands → countries → cities → stores). Clicking a row drills down. In this mode, clicking a breadcrumb jumps to that level's consolidated view.

```bash
npm install
npm run dev
```

Sign-in works like the POS: pick your profile on the carousel (tabs Cashiers, Managers, Waiters, Team, Office), then type your PIN. Office accounts get a password instead. Administrators can also tap their badge. Sign-in routes by role; the full workflow spec is in [docs/ROLE-ROUTING.md](docs/ROLE-ROUTING.md).

### The POS team

The POS is served from `public/pos` (a copy of caisse-manager-login-v2.vercel.app). Its 15 people are hub accounts too, with the same photos and the same PIN, `1234`. When one of them opens POS, POS Pro or POS Mobile from the hub, the POS opens straight on their own account (`/pos/index.html?staff=<first name>`), skipping its own profile and PIN screens. "Lock & switch user" in the POS signs them out of the hub.

| Tab | People | Lands on |
| --- | --- | --- |
| Cashiers | Youssef, Karim, Benaissa, Mehdi, Salma | Straight into POS, Panda Casablanca Centre |
| Managers | Hamza, Imane, Yassine, Omar, Anas | Launchpad (Store Manager), pinned to Panda Casablanca Centre |
| Waiters | Driss, Nadia, Rachid, Kenza, Leila | "Where are you working today?" → POS Mobile |

They can also sign in with email `<first name>@atlas.ma` and password `<first name>123`, e.g. `benaissa@atlas.ma` / `benaissa123`.

### Other accounts

| Tab | Sign in | Role | Lands on |
| --- | --- | --- | --- |
| Office | `admin@caissemanager.com` / `admin123`, or badge `0011665980` | Super Admin | Launchpad, 3 holdings, locked apps visible |
| Office | `manager@lumen.be` / `holding123` | Holding Admin | Launchpad, Lumen |
| Office | `brand@crusty.be` / `brand123` | Brand Manager | Launchpad, pinned to Crusty |
| Office | `benelux@caissemanager.com` / `region123` | Regional Manager | Launchpad, BE/NL/LU stores only |
| Office | `tom@crusty.be` / `store123` | Store Manager | Launchpad, pinned to Crusty Brussels Centre |
| Team | Rayan, PIN `3333` (`rayan@panda.be` / `kitchen123`) | Kitchen Post | Straight into KDS |
| Team | Hugo, PIN `4444` (`hugo@atlas.ma` / `driver123`) | Driver | Straight into Delivery App |
| Team | Lina, PIN `5555` (`lina@lumen.be` / `employee123`) | Employee | Straight into Attendance App |

## Structure

- `src/data/apps.ts`: the 17 apps, integrations, roles and per-holding subscriptions.
- `src/services/access.ts`: scope narrowing, open/locked status and the landing route.
- `src/screens/Login.tsx` (+ `src/styles/pos-login.css`): the POS-style sign-in.
- `src/screens/Launchpad.tsx`, `AppFrame.tsx`, `TargetPicker.tsx`: the hub, the launch sequence/app shell (embeds the POS, screen pairing), and the store picker.
- `public/pos/`: the POS build. The hub hand-off is the `?staff=` block near the end of its script.
- `src/styles/pos-theme.css`: restyles the hub to match the POS. Loaded last.
- `src/state.ts`: flow reducer, the 6-level path and the explore/consolidated mode. Holds the auto-skip rules.
- `src/lib/scope.ts`: works out which stores a scope covers and its breakdowns.
- `src/lib/kpis.ts` `consolidate()`: aggregates store KPIs for any scope. Sums, revenue-weighted deltas and mixes, averaged ratios.
- `src/services/api.ts`: mock `login()`. Replace it with the real auth endpoint; it must return `Session` (`src/data/types.ts`).
- `src/data/mock.ts`: holdings, brands (e.g. Crusty and Panda in Hospitality), stores, cities and demo users.
- `src/lib/kpis.ts`: deterministic mock KPIs per store. Swap this for the real reporting API.
- `src/screens/GeoExplorer.tsx`: one persistent SVG map (d3-geo + world-atlas) that flies between levels with van Wijk zoom interpolation.
- `src/components/Background.tsx`: canvas particle network and grid floor. Speeds up ("warp") on transitions.

## Brand

The app uses the Caisse Manager brand system as-is. It does not define a palette of its own.

- `src/styles/cm-tokens.css` is copied from `../design-system/dist/tokens.css`. Re-copy it whenever the design system rebuilds.
- `public/brand/` holds the official lockup and mark from `../Brand-guidelines` and `../design-system/reference/brand`.
- Theme: APP-01 Super Admin, which the design system assigns to **Cockpit** (dark, compact).
- Colour roles: brand red `#FB0000` for identity, primary actions and selection. Cockpit cyan for live data and gauges only. Brand Book chart colours for categorical data.
- Type is **Poppins** (Latin) and **Cairo** (Arabic), per the Brand Book. This overrides the IBM Plex default in the generated tokens.
- Error `#F04438` and warning `#F79009` come from the Brand Book. The design system's proposed crimson danger colour is still waiting for sign-off.
- Icons are Phosphor (`@phosphor-icons/react`), as the design system prescribes.
- No on-screen text is smaller than 12px (`--cm-text-2xs`).
