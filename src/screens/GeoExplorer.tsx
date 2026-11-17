import { geoArea, geoGraticule10, geoMercator, geoPath } from 'd3-geo'
import { interpolateZoom } from 'd3-interpolate'
import { ArrowLeft, MagnifyingGlass } from '@phosphor-icons/react'
import { AnimatePresence, animate, motion } from 'framer-motion'
import type { Feature, FeatureCollection, Geometry, MultiPolygon, Polygon } from 'geojson'
import { feature, merge } from 'topojson-client'
import type { GeometryCollection, MultiPolygon as TopoMultiPolygon, Polygon as TopoPolygon, Topology } from 'topojson-specification'
import { useEffect, useLayoutEffect, useMemo, useRef, useState, type ReactNode } from 'react'
import worldUrl from 'world-atlas/countries-50m.json?url'
import { DecodeText, RedWord, ease } from '../components/ui'
import { CITIES, cityById, countryById } from '../data/mock'
import type { Industry, Store } from '../data/types'
import { consolidate, eur } from '../lib/kpis'

type View = [number, number, number] // cx, cy, width (projected units)
type Level = 'country' | 'city' | 'store'

const BASE_W = 1000
const BASE_H = 620

let worldPromise: Promise<Feature<Geometry>[]> | null = null
export function loadWorld() {
  worldPromise ??= fetch(worldUrl)
    .then((r) => r.json())
    .then((topo: Topology) => {
      const fc = feature(topo, topo.objects.countries) as FeatureCollection<Geometry>
      // Morocco is drawn whole, with its southern provinces: world-atlas ships them as a separate
      // shape ('732'), so merge the two (dissolving the line between them) into Morocco ('504').
      const countries = (topo.objects.countries as GeometryCollection).geometries
      const moroccoParts = countries.filter((g) => g.id === '504' || g.id === '732') as Array<TopoPolygon | TopoMultiPolygon>
      const morocco: Feature<Geometry> = { type: 'Feature', id: '504', properties: { name: 'Morocco' }, geometry: merge(topo, moroccoParts) }
      return fc.features
        .filter((f) => f.id !== '010' && f.id !== '732') // drop Antarctica; '732' now lives inside Morocco
        .map((f) => (f.id === '504' ? morocco : f))
    })
  return worldPromise
}

// Fixed base projection: the screen size only changes the zoom factor, never the projected coordinates.
const projection = geoMercator()
  .scale(BASE_W / (2 * Math.PI))
  .translate([BASE_W / 2, BASE_H * 0.68])
const pathGen = geoPath(projection)
const project = (lon: number, lat: number) => projection([lon, lat]) as [number, number]

/** Largest polygon of a feature, so overseas territories don't skew bounds. */
function mainland(f: Feature<Geometry>): Feature<Polygon | MultiPolygon> {
  if (f.geometry.type !== 'MultiPolygon') return f as Feature<Polygon>
  let best: Polygon | null = null
  let bestArea = -1
  for (const coords of (f.geometry as MultiPolygon).coordinates) {
    const poly: Polygon = { type: 'Polygon', coordinates: coords }
    const a = geoArea(poly)
    if (a > bestArea) {
      bestArea = a
      best = poly
    }
  }
  return { ...f, geometry: best! } as Feature<Polygon>
}

type Bounds = [[number, number], [number, number]]
const union = (bs: Bounds[]): Bounds => [
  [Math.min(...bs.map((b) => b[0][0])), Math.min(...bs.map((b) => b[0][1]))],
  [Math.max(...bs.map((b) => b[1][0])), Math.max(...bs.map((b) => b[1][1]))],
]
const pointBounds = (pts: [number, number][]): Bounds => [
  [Math.min(...pts.map((p) => p[0])), Math.min(...pts.map((p) => p[1]))],
  [Math.max(...pts.map((p) => p[0])), Math.max(...pts.map((p) => p[1]))],
]

/**
 * Real street map at store level: Esri's grey canvas basemap (base + street-name layer, no API key).
 * The map already uses Web Mercator, the tiles' own projection, so a tile is just an image at its
 * projected square.
 */
const TILE_TOP = BASE_H * 0.68 - BASE_W / 2 // projected y of the Mercator world's top edge
type Tiles = { z: number; list: { x: number; y: number }[] }
/** Tiles laid out as plain HTML at the store view (`view`, zoom `k`, focal centre `cx`/`cy`). During
 * the flight the whole layer only gets a GPU transform, so it is never re-filtered or re-rastered. */
type TileLayer = Tiles & { view: View; k: number; cx: number; cy: number; box: { left: number; top: number; width: number; height: number } }

/** Screen box (at the store view) covered by a set of tiles. */
function tileBox(t: Tiles, view: View, k: number, cx: number, cy: number) {
  const ts = BASE_W / 2 ** t.z
  const xs = t.list.map((p) => p.x)
  const ys = t.list.map((p) => p.y)
  const left = cx + (Math.min(...xs) * ts - view[0]) * k
  const top = cy + (TILE_TOP + Math.min(...ys) * ts - view[1]) * k
  return { left, top, width: (Math.max(...xs) + 1 - Math.min(...xs)) * ts * k, height: (Math.max(...ys) + 1 - Math.min(...ys)) * ts * k }
}

/** Tiles covering the whole screen for a view. 256 px tiles, one zoom deeper on retina so they stay sharp. */
function tileCover(v: View, f: { w: number; cx: number; cy: number }, size: { w: number; h: number }): Tiles {
  const k = f.w / v[2]
  const tilePx = 256 / Math.min(2, window.devicePixelRatio || 1)
  const z = Math.max(2, Math.min(16, Math.round(Math.log2((BASE_W * k) / tilePx))))
  const n = 2 ** z
  const ts = BASE_W / n
  const clamp = (i: number) => Math.max(0, Math.min(n - 1, i))
  // One extra ring of tiles beyond the screen, so the layer's feathered edges stay off-screen.
  const tx0 = clamp(Math.floor((v[0] - f.cx / k) / ts) - 1)
  const tx1 = clamp(Math.floor((v[0] + (size.w - f.cx) / k) / ts) + 1)
  const ty0 = clamp(Math.floor((v[1] - f.cy / k - TILE_TOP) / ts) - 1)
  const ty1 = clamp(Math.floor((v[1] + (size.h - f.cy) / k - TILE_TOP) / ts) + 1)
  const list: Tiles['list'] = []
  for (let x = tx0; x <= tx1; x++) for (let y = ty0; y <= ty1; y++) list.push({ x, y })
  return { z, list }
}

const tileUrl = (theme: 'dark' | 'light', layer: 'Base' | 'Reference', z: number, x: number, y: number) =>
  `https://server.arcgisonline.com/ArcGIS/rest/services/Canvas/World_${theme === 'light' ? 'Light' : 'Dark'}_Gray_${layer}/MapServer/tile/${z}/${y}/${x}`

/**
 * Resolves once every tile of a cover is downloaded *and decoded* (or after a timeout, so a slow tile
 * never blocks the map). Decoding up front matters: otherwise the browser decodes ~200 images the
 * moment the street layer fades in, mid-zoom, and the dive stutters.
 */
function preloadTiles(t: Tiles, theme: 'dark' | 'light'): Promise<void> {
  const loads = (['Base', 'Reference'] as const).flatMap((layer) =>
    t.list.map((({ x, y }) => {
      const img = new Image()
      img.src = tileUrl(theme, layer, t.z, x, y)
      return img.decode().catch(() => undefined)
    }) as (p: { x: number; y: number }) => Promise<void>),
  )
  return Promise.race([Promise.all(loads).then(() => undefined), new Promise<void>((done) => setTimeout(done, 2500))])
}

/** The app theme ('dark' / 'light' on <html data-theme>), kept in sync when the user toggles it. */
function useDocTheme(): 'dark' | 'light' {
  const read = (): 'dark' | 'light' => (document.documentElement.dataset.theme === 'light' ? 'light' : 'dark')
  const [theme, setTheme] = useState(read)
  useEffect(() => {
    const mo = new MutationObserver(() => setTheme(read()))
    mo.observe(document.documentElement, { attributes: true, attributeFilter: ['data-theme'] })
    return () => mo.disconnect()
  }, [])
  return theme
}

interface Props {
  stores: Store[]
  industry: Industry
  countryId: string | null
  cityId: string | null
  onCountry: (id: string | null) => void
  onCity: (id: string | null) => void
  onStore: (id: string) => void
  onWarp: (on: boolean) => void
  /** Consolidated strip for the current geo scope. */
  pulse: ReactNode
  brandName: string
}

interface Item {
  id: string
  name: string
  sub: string
  count?: number
  status?: Store['status']
  revenue: number
  x: number
  y: number
}

export function GeoExplorer({ stores, industry, countryId, cityId, onCountry, onCity, onStore, onWarp, pulse, brandName }: Props) {
  const level: Level = !countryId ? 'country' : !cityId ? 'city' : 'store'
  const [features, setFeatures] = useState<Feature<Geometry>[] | null>(null)
  const [size, setSize] = useState({ w: 1200, h: 800 })
  const [hoverId, setHoverId] = useState<string | null>(null)
  const [tip, setTip] = useState<{ x: number; y: number; title: string; sub: string } | null>(null)
  const [query, setQuery] = useState('')
  const [locking, setLocking] = useState<string | null>(null)
  const [tiles, setTiles] = useState<TileLayer | null>(null)
  const [tilesOn, setTilesOn] = useState(false)
  const [flying, setFlying] = useState(false)
  const tilesRef = useRef(tiles)
  tilesRef.current = tiles
  const tileElRef = useRef<HTMLDivElement>(null)
  const pinsRef = useRef<SVGGElement>(null)
  const pinsSvgRef = useRef<SVGSVGElement>(null)
  const theme = useDocTheme()

  const wrapRef = useRef<HTMLDivElement>(null)
  const svgRef = useRef<SVGSVGElement>(null)
  const gRef = useRef<SVGGElement>(null)
  const viewRef = useRef<View>([BASE_W / 2, BASE_H / 2, BASE_W])
  const flightRef = useRef<ReturnType<typeof animate> | null>(null)

  useEffect(() => {
    loadWorld().then(setFeatures)
  }, [])

  useLayoutEffect(() => {
    const el = wrapRef.current!
    const ro = new ResizeObserver(() => setSize({ w: el.clientWidth, h: el.clientHeight }))
    ro.observe(el)
    setSize({ w: el.clientWidth, h: el.clientHeight })
    return () => ro.disconnect()
  }, [])

  // Area of the screen not covered by the HUD / side panel.
  const focal = useMemo(() => {
    const wide = size.w > 900
    const x0 = 24
    const x1 = wide ? size.w - 420 : size.w - 24
    const y0 = wide ? 170 : 240
    const y1 = wide ? size.h - 130 : size.h * 0.55 // wide: stay above the consolidation strip
    return { w: x1 - x0, h: y1 - y0, cx: (x0 + x1) / 2, cy: (y0 + y1) / 2 }
  }, [size])
  const focalRef = useRef(focal)
  focalRef.current = focal

  const apply = (v: View) => {
    const f = focalRef.current
    const k = f.w / v[2]
    const t = `translate(${f.cx - v[0] * k},${f.cy - v[1] * k}) scale(${k})`
    gRef.current?.setAttribute('transform', t)
    pinsRef.current?.setAttribute('transform', t)
    // Only the pins counter-scale with the zoom; setting --k on the land layer would restyle every
    // country path on every frame of a flight.
    pinsSvgRef.current?.style.setProperty('--k', String(k))
    // Street layer: scale/offset relative to the view it was laid out for (identity once landed).
    const tl = tilesRef.current
    const el = tileElRef.current
    if (tl && el) {
      const ratio = k / tl.k
      const tx = f.cx - tl.cx * ratio + (tl.view[0] - v[0]) * k
      const ty = f.cy - tl.cy * ratio + (tl.view[1] - v[1]) * k
      // The layer sits at its box's corner and scales about it, so shift by what the scale moves it.
      el.style.transform = `translate(${tx - tl.box.left * (1 - ratio)}px,${ty - tl.box.top * (1 - ratio)}px) scale(${ratio})`
    }
  }

  const viewFor = (b: Bounds, pad = 1.35, minW = 0): View => {
    const f = focalRef.current
    const dx = b[1][0] - b[0][0]
    const dy = b[1][1] - b[0][1]
    const w = Math.max(dx, (dy * f.w) / f.h, minW) * pad
    return [(b[0][0] + b[1][0]) / 2, (b[0][1] + b[1][1]) / 2, w]
  }

  /** Camera view for a city's store level: its stores, with at least ~12 km of street context. */
  const storeView = (cid: string): View => {
    const city = cityById(cid)
    const [cx] = project(city.lon, city.lat)
    const [ex] = project(city.lon + 0.12, city.lat)
    const pts = stores.filter((s) => s.cityId === cid).map((s) => project(s.lon, s.lat))
    return viewFor(pointBounds(pts.length ? pts : [project(city.lon, city.lat)]), 1.5, ex - cx)
  }

  // Hovering a city starts downloading its street tiles, so they're cached by the time it's clicked.
  const prefetched = useRef(new Set<string>())
  const prefetch = (cid: string) => {
    if (level !== 'city' || prefetched.current.has(cid)) return
    prefetched.current.add(cid)
    preloadTiles(tileCover(storeView(cid), focalRef.current, size), theme)
  }

  const featureById = useMemo(() => new Map((features ?? []).map((f) => [String(f.id), f])), [features])
  const paths = useMemo(() => (features ?? []).map((f) => ({ id: String(f.id), d: pathGen(f) ?? '' })), [features])
  const graticule = useMemo(() => pathGen(geoGraticule10()) ?? '', [])

  const storeCountByCountry = useMemo(() => {
    const m = new Map<string, number>()
    for (const s of stores) m.set(s.countryId, (m.get(s.countryId) ?? 0) + 1)
    return m
  }, [stores])

  const items: Item[] = useMemo(() => {
    if (level === 'country') {
      return [...storeCountByCountry.entries()]
        .map(([id, count]) => {
          const cs = stores.filter((s) => s.countryId === id)
          const lon = cs.reduce((a, s) => a + s.lon, 0) / cs.length
          const lat = cs.reduce((a, s) => a + s.lat, 0) / cs.length
          const [x, y] = project(lon, lat)
          const cities = new Set(cs.map((s) => s.cityId)).size
          return { id, name: countryById(id).name, sub: `${cities} cit${cities > 1 ? 'ies' : 'y'}`, count, revenue: consolidate(cs).revenueToday, x, y }
        })
        .sort((a, b) => b.count! - a.count!)
    }
    if (level === 'city') {
      return CITIES.filter((c) => c.countryId === countryId)
        .map((c) => {
          const cs = stores.filter((s) => s.cityId === c.id)
          const [x, y] = project(c.lon, c.lat)
          return { id: c.id, name: c.name, sub: countryById(c.countryId).code, count: cs.length, revenue: cs.length ? consolidate(cs).revenueToday : 0, x, y }
        })
        .filter((c) => c.count > 0)
        .sort((a, b) => b.count! - a.count!)
    }
    return stores
      .filter((s) => s.cityId === cityId)
      .map((s) => {
        const [x, y] = project(s.lon, s.lat)
        return { id: s.id, name: s.name, sub: s.address, status: s.status, revenue: consolidate([s]).revenueToday, x, y }
      })
  }, [level, stores, storeCountByCountry, countryId, cityId])

  // Fly to the right view whenever the level / selection / screen changes.
  useEffect(() => {
    if (!features) return
    let target: View
    if (level === 'country') {
      const bs = [...storeCountByCountry.keys()].map((id) => featureById.get(id)).filter(Boolean).map((f) => pathGen.bounds(mainland(f!)) as Bounds)
      target = viewFor(bs.length ? union(bs) : [[0, 0], [BASE_W, BASE_H]], 1.25, 35) // keep regional context
    } else if (level === 'city') {
      const f = featureById.get(countryId!)
      const cityPts = items.map((i) => [i.x, i.y] as [number, number])
      const b = f ? union([pathGen.bounds(mainland(f)) as Bounds, pointBounds(cityPts)]) : pointBounds(cityPts)
      target = viewFor(b, 1.2)
    } else {
      target = storeView(cityId!)
    }
    // Street tiles: zooming in, they load during the flight and fade in from just before halfway once
    // all are ready (no tile-by-tile popping); zooming out, they fade away with the camera.
    const toStore = level === 'store'
    let alive = true
    let loaded = false
    let landing = false
    const reveal = () => alive && loaded && landing && setTilesOn(true)
    setTilesOn(false)
    if (toStore) {
      const f = focalRef.current
      const cover = tileCover(target, f, size)
      const k = f.w / target[2]
      setTiles({ ...cover, view: target, k, cx: f.cx, cy: f.cy, box: tileBox(cover, target, k, f.cx, f.cy) })
      preloadTiles(cover, theme).then(() => {
        loaded = true
        reveal()
      })
    }
    flightRef.current?.stop()
    const from = viewRef.current
    const interp = interpolateZoom(from, target)
    // Never shorter than 1.5 s, so even short hops glide; the dive into the streets gets a little
    // longer and settles softly (gentle start, long ease-out) rather than braking hard.
    const duration = Math.min(2.6, Math.max(toStore ? 1.9 : 1.5, interp.duration / 1000))
    setFlying(true)
    flightRef.current = animate(0, 1, {
      duration,
      ease: toStore ? [0.5, 0, 0.15, 1] : [0.65, 0, 0.35, 1],
      onUpdate: (t) => {
        const v = interp(t) as View
        viewRef.current = v
        apply(v)
        if (toStore && !landing && t > 0.45) {
          landing = true
          reveal()
        }
      },
      onComplete: () => {
        landing = true
        setFlying(false)
        if (toStore) reveal()
        else setTiles(null)
      },
    })
    return () => {
      alive = false
      flightRef.current?.stop()
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [features, level, countryId, cityId, focal])

  // Position a freshly laid-out street layer for the camera's current view right away.
  useLayoutEffect(() => {
    apply(viewRef.current)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [tiles])

  useEffect(() => {
    setQuery('')
    setHoverId(null)
    setTip(null)
  }, [level])

  const select = (id: string) => {
    if (locking) return
    if (level === 'country') onCountry(id)
    else if (level === 'city') onCity(id)
    else {
      setLocking(id)
      onWarp(true)
      window.setTimeout(() => {
        onStore(id)
        onWarp(false)
      }, 1300)
    }
  }

  const back = () => {
    if (level === 'store') onCity(null)
    else if (level === 'city') onCountry(null)
  }

  const showTip = (e: React.PointerEvent, title: string, sub: string) => {
    const r = wrapRef.current!.getBoundingClientRect()
    setTip({ x: e.clientX - r.left, y: e.clientY - r.top, title, sub })
  }

  const filtered = items.filter((i) => i.name.toLowerCase().includes(query.toLowerCase()))
  const place = level === 'city' ? countryById(countryId!).name : level === 'store' ? cityById(cityId!).name : null

  const heading = {
    country: { idx: 'A', eyebrow: 'GEO-SCAN · COUNTRY', title: 'Select a country' },
    city: { idx: 'B', eyebrow: `GEO-SCAN · ${place?.toUpperCase()}`, title: 'Select a city' },
    store: { idx: 'C', eyebrow: `GEO-SCAN · ${place?.toUpperCase()}`, title: 'Lock onto a store' },
  }[level]

  return (
    <div className={`geo level-${level}`} ref={wrapRef}>
      <svg ref={svgRef} className="geo-svg" width={size.w} height={size.h} onPointerLeave={() => setTip(null)}>
        <defs>
          {/* Grey street tiles → mostly neutral map with red only on the main roads: tiles go to plain
              brightness, then a curve maps it to colour (background stays dark grey, side streets soft
              grey, only the brightest roads turn Caisse red). */}
          <filter id="red-streets" colorInterpolationFilters="sRGB">
            <feColorMatrix type="matrix" values=".333 .333 .333 0 0  .333 .333 .333 0 0  .333 .333 .333 0 0  0 0 0 1 0" />
            <feComponentTransfer>
              <feFuncR type="table" tableValues="0 .01 .02 .03 .04 .05 .13 .22 .56 .7 .75 .78 .8 .83 .85 .88 .9 .93 .95 .98 1" />
              <feFuncG type="table" tableValues="0 .01 .02 .03 .04 .05 .13 .17 .19 .25 .3 .35 .4 .45 .5 .55 .6 .65 .7 .75 .8" />
              <feFuncB type="table" tableValues="0 .01 .02 .03 .045 .055 .14 .18 .21 .27 .32 .37 .42 .47 .52 .57 .62 .67 .72 .77 .82" />
            </feComponentTransfer>
          </filter>
        </defs>
        <g ref={gRef}>
          <path d={graticule} className="graticule" />
          {paths.map(({ id, d }, i) => {
            const has = storeCountByCountry.has(id)
            const cls =
              level === 'country'
                ? has
                  ? 'land active'
                  : 'land'
                : id === countryId
                  ? 'land focus'
                  : 'land muted'
            return (
              <path
                key={`${id}-${i}`}
                d={d}
                className={`${cls} ${hoverId === id ? 'hover' : ''}`}
                onPointerMove={(e) => {
                  if (level !== 'country') return
                  if (has) {
                    setHoverId(id)
                    showTip(e, countryById(id).name, `${storeCountByCountry.get(id)} ${industry.name} stores`)
                  } else {
                    setHoverId(null)
                    setTip(null)
                  }
                }}
                onClick={() => level === 'country' && has && select(id)}
              />
            )
          })}

        </g>
      </svg>

      {tiles && (
        <div
          ref={tileElRef}
          className={`tile-layer ${tilesOn ? 'on' : ''} ${flying ? 'flying' : ''}`}
          style={{ left: tiles.box.left, top: tiles.box.top, width: tiles.box.width, height: tiles.box.height }}
          aria-hidden
        >
          {(['Base', 'Reference'] as const).map((layer) => (
            // Dark theme: the street layer is recoloured so the main roads read as Caisse-red lines.
            <div key={layer} className={`tile-${layer.toLowerCase()} ${layer === 'Base' && theme === 'dark' ? 'red' : ''}`}>
              {tiles.list.map(({ x, y }) => {
                const ts = BASE_W / 2 ** tiles.z
                const px = ts * tiles.k
                // Half a pixel of overlap hides seams between base tiles.
                const o = layer === 'Base' ? 0.5 : 0
                return (
                  <img
                    key={`${theme}/${tiles.z}/${x}/${y}`}
                    src={tileUrl(theme, layer, tiles.z, x, y)}
                    alt=""
                    draggable={false}
                    style={{
                      left: tiles.cx + (x * ts - tiles.view[0]) * tiles.k - tiles.box.left,
                      top: tiles.cy + (TILE_TOP + y * ts - tiles.view[1]) * tiles.k - tiles.box.top,
                      width: px + o,
                      height: px + o,
                    }}
                  />
                )
              })}
            </div>
          ))}
        </div>
      )}

      <svg ref={pinsSvgRef} className="geo-svg geo-pins" width={size.w} height={size.h}>
        <defs>
          <radialGradient id="pinGlow">
            <stop offset="0" stopColor="var(--accent)" stopOpacity="0.6" />
            <stop offset="1" stopColor="var(--accent)" stopOpacity="0" />
          </radialGradient>
        </defs>
        <g ref={pinsRef}>
          {items.map((it, i) => {
            const isHover = hoverId === it.id
            const isLock = locking === it.id
            return (
              <g
                key={`${level}-${it.id}`}
                transform={`translate(${it.x},${it.y})`}
                className={`pin pin-${level} ${isHover ? 'hover' : ''} ${isLock ? 'lock' : ''} ${locking && !isLock ? 'dim' : ''} ${it.status ?? ''}`}
                // Store pins wait until the dive has spread them apart, so their labels never pile up.
                style={{ animationDelay: `${level === 'store' ? 1.1 + i * 0.08 : 0.6 + i * 0.06}s` }}
                onPointerEnter={(e) => {
                  prefetch(it.id)
                  setHoverId(it.id)
                  showTip(e, it.name, it.count != null ? `${it.count} stores · ${it.sub}` : it.sub)
                }}
                onPointerLeave={() => {
                  setHoverId(null)
                  setTip(null)
                }}
                onClick={() => select(it.id)}
              >
                <g className="pin-inner">
                  <circle r="26" fill="url(#pinGlow)" className="pin-glow" />
                  <circle r="14" className="pin-pulse" />
                  <circle r="14" className="pin-pulse p2" />
                  <circle r={level === 'store' ? 6 : 5} className="pin-dot" />
                  {level !== 'store' && it.count != null && (
                    <g className="pin-badge" transform="translate(10,-24)">
                      <rect width={it.count > 9 ? 26 : 20} height="16" rx="3" />
                      <text x={it.count > 9 ? 13 : 10} y="12" textAnchor="middle">
                        {it.count}
                      </text>
                    </g>
                  )}
                  <text className="pin-label" x="14" y="5">
                    {it.name}
                  </text>
                  {isLock && (
                    <g className="reticle">
                      <circle r="34" />
                      <path d="M-46 0h16M30 0h16M0 -46v16M0 30v16" />
                      <path d="M-24 -24h10M-24 -24v10M24 -24h-10M24 -24v10M-24 24h10M-24 24v-10M24 24h-10M24 24v-10" />
                    </g>
                  )}
                </g>
              </g>
            )
          })}
        </g>
      </svg>

      <div className="geo-grid-overlay" />
      {level === 'store' && (
        <div className="geo-attrib label">
          Powered by{' '}
          <a href="https://www.esri.com" target="_blank" rel="noreferrer">
            Esri
          </a>{' '}
          · Esri, HERE, Garmin, © OpenStreetMap contributors
        </div>
      )}

      <AnimatePresence mode="wait">
        <motion.div
          key={level}
          className="geo-heading"
          initial={{ opacity: 0, y: 16 }}
          animate={{ opacity: 1, y: 0 }}
          exit={{ opacity: 0, y: -10 }}
          transition={{ duration: 0.5, ease }}
        >
          <div className="eyebrow">
            <span className="eyebrow-index">{heading.idx}</span>
            <span className="eyebrow-line" />
            <DecodeText text={heading.eyebrow} />
          </div>
          <h1 className="step-title"><RedWord text={heading.title} /></h1>
        </motion.div>
      </AnimatePresence>

      <div className="geo-pulse">{pulse}</div>

      {tip && (
        <div className="geo-tip" style={{ left: tip.x + 16, top: tip.y + 16 }}>
          <b>{tip.title}</b>
          <span className="label">{tip.sub}</span>
        </div>
      )}

      {!features && (
        <div className="geo-loading label">
          <span className="spinner" /> Loading geospatial layer…
        </div>
      )}

      <motion.aside
        className="panel geo-panel"
        initial={{ opacity: 0, x: 60 }}
        animate={{ opacity: 1, x: 0 }}
        transition={{ duration: 0.8, delay: 0.3, ease }}
      >
        <span className="corner tl" />
        <span className="corner br" />
        <div className="geo-panel-head">
          {level !== 'country' ? (
            <button className="btn-ghost" onClick={back} disabled={!!locking}>
              <ArrowLeft size={14} weight="bold" /> {level === 'store' ? countryById(countryId!).name : 'All countries'}
            </button>
          ) : (
            <span className="label dim">{brandName} network</span>
          )}
          <span className="label dim">
            {items.length} {level === 'country' ? 'countries' : level === 'city' ? 'cities' : 'stores'}
          </span>
        </div>
        <div className="search">
          <MagnifyingGlass size={18} />
          <input placeholder={`Search ${level === 'country' ? 'countries' : level === 'city' ? 'cities' : 'stores'}…`} value={query} onChange={(e) => setQuery(e.target.value)} />
        </div>

        <AnimatePresence mode="wait">
          {locking ? (
            <motion.div key="lock" className="lock-state" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}>
              <div className="lock-ring">
                <i />
                <i />
              </div>
              <DecodeText className="label" text="ESTABLISHING UPLINK" speed={20} />
              <b>{items.find((i) => i.id === locking)?.name}</b>
              <div className="progress">
                <motion.i initial={{ width: 0 }} animate={{ width: '100%' }} transition={{ duration: 1.2, ease: 'easeInOut' }} />
              </div>
            </motion.div>
          ) : (
            <motion.ul key={level + (countryId ?? '') + (cityId ?? '')} className="geo-list">
              {filtered.map((it, i) => (
                <motion.li
                  key={it.id}
                  initial={{ opacity: 0, x: 24 }}
                  animate={{ opacity: 1, x: 0 }}
                  transition={{ duration: 0.45, delay: 0.15 + i * 0.04, ease }}
                >
                  <button
                    className={`geo-item ${hoverId === it.id ? 'hover' : ''}`}
                    onPointerEnter={() => (prefetch(it.id), setHoverId(it.id))}
                    onPointerLeave={() => setHoverId(null)}
                    onClick={() => select(it.id)}
                  >
                    <span className="gi-main">
                      <b>{it.name}</b>
                      <small className="label">{level === 'country' ? countryById(it.id).code + ' · ' + it.sub : it.sub}</small>
                    </span>
                    <span className="gi-rev">
                      <b>{eur(it.revenue)}</b>
                      {it.count != null ? (
                        <small className="label dim">{it.count} {it.count === 1 ? 'store' : 'stores'}</small>
                      ) : (
                        <span className={`status ${it.status}`}>{it.status}</span>
                      )}
                    </span>
                  </button>
                </motion.li>
              ))}
              {filtered.length === 0 && <li className="label dim empty">No match</li>}
            </motion.ul>
          )}
        </AnimatePresence>
      </motion.aside>
    </div>
  )
}
