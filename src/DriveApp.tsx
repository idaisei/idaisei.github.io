"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { ArrowRight, BookOpen, ChevronRight, Compass, ExternalLink, LocateFixed, MapPin, Navigation, Search, Sparkles, Stamp, Star, X } from "lucide-react";
import type * as Leaflet from "leaflet";
import rawStations from "../data/stations.json";
import rawMagazine from "../data/discoveries.json";
import rawOfficial from "../data/official_discoveries.json";
import rawDesigns from "../data/stamp_designs.json";

type Station = {
  id: string; name: string; prefecture: string; address: string; phone: string; hours: string;
  closed: string; road: string; access: string; status: string; alerts: string[];
  facilities: string[]; directions: string; officialUrl: string | null;
  coordinates: [number, number] | null; image?: string; imageSource?: string; magazineSpreads: string[];
};
type Discovery = { stationId: string; category: string; title: string; detail: string; pageId?: string; sourceUrl?: string; imageFilename?: string | null };
type Design = { stationId: string; motif: string; emoji: string; category: string; characterName: string; archetype: string; silhouetteVariant: number; eyeStyle: number; markStyle: number; hue: number; pageId?: string | null };
type StampRecord = { stationId: string; stampedAt: string };
type Tab = "find" | "map" | "stamps" | "guide";
const stations = rawStations as unknown as Station[];
const discoveries = [...rawMagazine, ...rawOfficial] as Discovery[];
const designs = Object.fromEntries((rawDesigns as Design[]).map((d) => [d.stationId, d])) as Record<string, Design>;
const byStation = new Map<string, Discovery[]>();
for (const item of discoveries) byStation.set(item.stationId, [...(byStation.get(item.stationId) || []), item]);
const prefs = ["すべて", "福岡県", "佐賀県", "長崎県", "熊本県", "大分県", "宮崎県", "鹿児島県"];
const short: Record<string,string> = { 福岡県: "福岡", 佐賀県: "佐賀", 長崎県: "長崎", 熊本県: "熊本", 大分県: "大分", 宮崎県: "宮崎", 鹿児島県: "鹿児島" };
const categories = ["すべて", "ソフト", "名産", "食事", "景色", "体験", "施設"];
const categoryColors: Record<string,string> = { ソフト: "#ee77a6", 名産: "#f6a54b", 食事: "#e57855", 景色: "#59b6be", 体験: "#946bd1", 施設: "#5b89d9" };
const guideStations = stations.filter((s) => (rawMagazine as Discovery[]).some((d) => d.stationId === s.id));
const stampStorageKey = "kyushu-quest-stamps-v1";
function distanceKm(a: [number, number], b: [number, number]) {
  const rad = Math.PI / 180, dLat = (b[0] - a[0]) * rad, dLon = (b[1] - a[1]) * rad;
  const h = Math.sin(dLat / 2) ** 2 + Math.cos(a[0] * rad) * Math.cos(b[0] * rad) * Math.sin(dLon / 2) ** 2;
  return 12742 * Math.asin(Math.min(1, Math.sqrt(h)));
}

function mascotShape(kind: string, fill: string, variant: number) {
  const stroke = "#25396e";
  const props = { fill, stroke, strokeWidth: 3.2, strokeLinejoin: "round" as const };
  switch (kind) {
    case "swirl": return <><path d="M34 42 Q25 36 37 29 Q30 20 45 19 Q42 11 55 13 Q67 16 58 27 Q72 27 69 38 Q77 44 66 50 L37 52 Z" {...props}/><path d="M31 49 L69 49 L61 83 Q50 92 39 83 Z" fill="#d69a63" stroke={stroke} strokeWidth="3"/></>;
    case "fruit": return <><path d="M51 30 Q42 14 59 12" fill="none" stroke={stroke} strokeWidth="4"/><path d="M53 21 Q65 9 72 20 Q63 28 53 21" fill="#5bbd7c" stroke={stroke} strokeWidth="3"/><path d="M50 31 C20 19 15 63 31 77 Q50 92 69 77 C84 62 80 20 50 31 Z" {...props}/></>;
    case "fish": return <><path d="M22 50 L8 33 L8 68 Z" {...props}/><path d="M20 50 Q37 19 69 35 Q86 48 68 66 Q37 82 20 50 Z" {...props}/><path d="M48 34 L57 20 L65 36" {...props}/></>;
    case "octopus": return <><path d="M32 57 Q17 80 27 84 Q36 89 39 72 Q40 90 50 88 Q58 87 56 71 Q68 87 75 81 Q81 75 68 57" {...props}/><ellipse cx="50" cy="45" rx="25" ry="27" {...props}/></>;
    case "beetle": return <><path d="M42 30 L32 15 L43 22 L50 30 L57 22 L68 15 L58 30" {...props}/><ellipse cx="50" cy="56" rx="25" ry="29" {...props}/><path d="M50 30 L50 83 M26 50 L16 43 M74 50 L84 43 M28 66 L17 76 M72 66 L83 76" fill="none" stroke={stroke} strokeWidth="3"/></>;
    case "shell": return <><path d="M18 69 Q17 33 50 23 Q83 33 82 69 Z" {...props}/><path d="M50 25 L50 69 M34 31 L41 69 M66 31 L59 69 M21 69 Q50 83 79 69" fill="none" stroke={stroke} strokeWidth="3"/></>;
    case "bowl": return <><path d="M22 52 Q23 82 50 84 Q77 82 78 52 Z" {...props}/><ellipse cx="50" cy="51" rx="28" ry="9" fill="#fff1be" stroke={stroke} strokeWidth="3"/><path d="M35 35 Q29 29 37 22 M51 34 Q44 26 53 18 M65 35 Q59 27 68 21" fill="none" stroke={stroke} strokeWidth="3"/></>;
    case "spring": return <><path d="M22 51 Q13 67 28 78 Q50 92 72 78 Q87 67 78 51 Z" {...props}/><ellipse cx="50" cy="51" rx="28" ry="10" fill="#b9f4ef" stroke={stroke} strokeWidth="3"/><path d="M37 32 Q31 24 39 18 M55 35 Q49 27 58 19" fill="none" stroke={stroke} strokeWidth="3"/></>;
    case "plant": return <><path d="M50 78 L50 35" fill="none" stroke={stroke} strokeWidth="5"/><path d="M50 48 Q16 15 21 50 Q34 59 50 48 M50 45 Q82 15 79 51 Q65 56 50 45" {...props}/><path d="M33 70 Q50 59 67 70 L63 84 L37 84 Z" fill="#d99b68" stroke={stroke} strokeWidth="3"/></>;
    case "house": return <><path d="M17 49 L50 19 L83 49 L76 49 L76 81 L24 81 L24 49 Z" {...props}/><path d="M43 81 L43 56 L58 56 L58 81" fill="#fff0cf" stroke={stroke} strokeWidth="3"/></>;
    case "landscape": return <><path d="M14 69 L35 31 L49 51 L64 26 L86 69 Q69 86 49 84 Q28 85 14 69 Z" {...props}/><path d="M27 52 L35 42 L43 54 M56 48 L64 37 L72 50" fill="none" stroke="white" strokeWidth="4"/></>;
    case "craft": return <><path d="M50 15 L61 32 L81 31 L72 51 L82 69 L59 68 L50 86 L39 68 L18 69 L28 51 L19 31 L40 32 Z" {...props}/></>;
    case "snack": return <><path d="M30 27 Q49 18 70 27 L75 74 Q50 89 25 74 Z" {...props}/><path d="M30 36 Q50 43 70 36 M30 69 Q50 61 70 69" fill="none" stroke={stroke} strokeWidth="3"/></>;
    default: return <><path d="M26 38 L31 18 L43 33 Q50 29 57 33 L69 18 L74 38 Q84 56 74 74 Q50 88 26 74 Q16 55 26 38 Z" {...props}/>{variant % 2 === 0 && <path d="M19 52 L8 44 M81 52 L92 44" stroke={stroke} strokeWidth="3"/>}</>;
  }
}
function Mascot({ id, size = 84 }: { id: string; size?: number }) {
  const d = designs[id];
  if (!d) return null;
  const faceY = ["swirl", "beetle", "octopus"].includes(d.archetype) ? -8 : ["bowl", "spring", "house", "plant", "landscape", "craft"].includes(d.archetype) ? 8 : 1;
  return <svg className="mascot" width={size} height={size} viewBox="0 0 100 100" role="img" aria-label={d.characterName + "、" + d.motif + "がモチーフ"}>
    {mascotShape(d.archetype, "hsl(" + Math.round(d.hue * 360) + " 72% 72%)", d.silhouetteVariant)}
    <g transform={"translate(0 " + faceY + ")"}>
      {d.eyeStyle === 2 ? <><path d="M36 54 Q41 47 46 54 M54 54 Q59 47 64 54" fill="none" stroke="#25396e" strokeWidth="3.5" strokeLinecap="round"/></> : <><ellipse cx="40" cy="54" rx={d.eyeStyle === 3 ? 3 : 4} ry={d.eyeStyle === 3 ? 5 : 4} fill="#25396e"/><ellipse cx="60" cy="54" rx={d.eyeStyle === 3 ? 3 : 4} ry={d.eyeStyle === 3 ? 5 : 4} fill="#25396e"/></>}
      <ellipse cx="28" cy="62" rx="6" ry="3" fill="#f27d9d" opacity=".8"/><ellipse cx="72" cy="62" rx="6" ry="3" fill="#f27d9d" opacity=".8"/>
      <path d="M46 67 Q50 72 54 67" fill="none" stroke="#25396e" strokeWidth="2.6" strokeLinecap="round"/>
      {d.markStyle === 1 && <path d="M50 32 L52 37 L58 38 L53 42 L54 47 L50 44 L46 47 L47 42 L42 38 L48 37 Z" fill="#ffde63"/>}
    </g>
    <text x={d.archetype === "fish" ? 10 : 72} y="89" fontSize="20">{d.emoji}</text>
  </svg>;
}
function Medal({ id, collected, size = 76 }: { id: string; collected: boolean; size?: number }) {
  return <div className={"medal " + (collected ? "collected" : "")} style={{ width: size, height: size }}><Mascot id={id} size={size * .76}/></div>;
}
function Photo({ station, className = "" }: { station: Station; className?: string }) {
  return station.image ? <img className={className} src={station.image} alt={"道の駅 " + station.name} loading="lazy"/> : <div className={className + " photo-placeholder"}><MapPin/></div>;
}
function StationMap({ visible, stamped, onSelect, prefecture, nearbyLocation }: { visible: Station[]; stamped: Set<string>; onSelect: (s: Station) => void; prefecture: string; nearbyLocation: [number, number] | null }) {
  const element = useRef<HTMLDivElement>(null), map = useRef<Leaflet.Map | null>(null), layer = useRef<Leaflet.LayerGroup | null>(null), leaflet = useRef<typeof Leaflet | null>(null), lastFit = useRef("");
  const [ready, setReady] = useState(false), [zoom, setZoom] = useState(7), [locating, setLocating] = useState(false);
  useEffect(() => { let active = true; import("leaflet").then((L) => {
    if (!active || !element.current || map.current) return;
    leaflet.current = L;
    map.current = L.map(element.current, { zoomControl: false, scrollWheelZoom: true, touchZoom: true, doubleClickZoom: true }).setView([32.85, 130.65], 7);
    L.tileLayer("https://tile.openstreetmap.org/{z}/{x}/{y}.png", { maxZoom: 19, attribution: '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>' }).addTo(map.current);
    layer.current = L.layerGroup().addTo(map.current);
    map.current.on("zoomend", () => setZoom(map.current?.getZoom() || 7));
    setReady(true); window.setTimeout(() => map.current?.invalidateSize(), 150);
  }); return () => { active = false; map.current?.remove(); map.current = null; layer.current = null; leaflet.current = null; }; }, []);
  useEffect(() => { const L = leaflet.current; if (!ready || !L || !map.current || !layer.current) return;
    layer.current.clearLayers(); const points: [number,number][] = [];
    const groups = new Map<string, Station[]>();
    for (const s of visible) { if (!s.coordinates) continue; points.push(s.coordinates);
      const pixel = map.current.project(s.coordinates, zoom);
      const key = Math.floor(pixel.x / 52) + ":" + Math.floor(pixel.y / 52);
      groups.set(key, [...(groups.get(key) || []), s]);
    }
    for (const members of groups.values()) {
      if (members.length > 1 && zoom < 14) {
        const center: [number,number] = [members.reduce((n,s) => n + s.coordinates![0],0) / members.length, members.reduce((n,s) => n + s.coordinates![1],0) / members.length];
        const icon = L.divIcon({ className: "pin-wrap", html: '<span class="cluster-bubble">' + members.length + "</span>", iconSize: [40,40], iconAnchor: [20,20] });
        L.marker(center, { icon, title: members.length + "駅" }).on("click", () => map.current?.fitBounds(members.map((s) => s.coordinates!), { padding: [40,40], maxZoom: Math.min(zoom + 3, 14) })).addTo(layer.current);
      } else for (const s of members) {
        const icon = L.divIcon({ className: "pin-wrap", html: '<span class="quest-pin ' + (stamped.has(s.id) ? "done" : "") + '">' + (stamped.has(s.id) ? "✓" : "★") + "</span>", iconSize: [35,42], iconAnchor: [18,39] });
        L.marker(s.coordinates!, { icon, title: s.name }).on("click", () => onSelect(s)).addTo(layer.current);
      }
    }
    const fitKey = prefecture === "すべて" ? "" : prefecture;
    if (fitKey && fitKey !== lastFit.current && points.length) map.current.fitBounds(points, { padding: [45,45], maxZoom: 10 });
    else if (!fitKey && lastFit.current) map.current.setView([32.85,130.65],7);
    lastFit.current = fitKey;
  }, [ready, zoom, visible, stamped, onSelect, prefecture]);
  useEffect(() => {
    if (!ready || !nearbyLocation || !map.current || !leaflet.current) return;
    map.current.flyTo(nearbyLocation, 10);
    leaflet.current.circleMarker(nearbyLocation, { radius: 9, color: "#fff", weight: 3, fillColor: "#4168d9", fillOpacity: 1 }).addTo(map.current);
  }, [ready, nearbyLocation]);
  function locate() { if (!navigator.geolocation || !map.current) return; setLocating(true); navigator.geolocation.getCurrentPosition((p) => {
    if (!map.current || !leaflet.current) return; const xy: [number,number] = [p.coords.latitude,p.coords.longitude]; map.current.flyTo(xy, 12); leaflet.current.circleMarker(xy, { radius: 9, color: "#fff", weight: 3, fillColor: "#4168d9", fillOpacity: 1 }).addTo(map.current); setLocating(false);
  }, () => setLocating(false), { enableHighAccuracy: true, timeout: 12000 }); }
  return <div className="map-frame"><div ref={element} className="map-canvas" aria-label="道の駅の地図"/>
    <div className="map-tools"><button onClick={() => map.current?.zoomIn()} aria-label="拡大">＋</button><button onClick={() => map.current?.zoomOut()} aria-label="縮小">−</button><button onClick={locate} aria-label="現在地"><LocateFixed size={22}/></button></div>
    <div className="map-ribbon"><span className="ribbon-star">★</span><div><b>{visible.length} 駅を表示中</b><small>ピンから詳細・Google マップで案内</small></div>{locating && <span>現在地を取得中</span>}</div>
  </div>;
}

export default function DriveApp() {
  const [tab, setTab] = useState<Tab>("find");
  const [pref, setPref] = useState("すべて");
  const [category, setCategory] = useState("すべて");
  const [query, setQuery] = useState("");
  const [nearby, setNearby] = useState(false);
  const [userLocation, setUserLocation] = useState<[number, number] | null>(null);
  const [locatingNearby, setLocatingNearby] = useState(false);
  const [locationError, setLocationError] = useState("");
  const [selected, setSelected] = useState<Station | null>(null);
  const [stampRows, setStampRows] = useState<StampRecord[]>([]);
  const [busy, setBusy] = useState(false), [message, setMessage] = useState("");
  const [stampMode, setStampMode] = useState<"all" | "done" | "left">("all");
  const stamped = useMemo(() => new Set(stampRows.map((r) => r.stationId)), [stampRows]);
  const visible = useMemo(() => stations.filter((s) => {
    if (pref !== "すべて" && s.prefecture !== pref) return false;
    const items = byStation.get(s.id) || [];
    if (category !== "すべて" && !items.some((i) => i.category === category)) return false;
    const q = query.trim().toLocaleLowerCase();
    return !q || [s.name,s.prefecture,s.address,designs[s.id]?.motif,...items.map((i) => i.title)].join(" ").toLocaleLowerCase().includes(q);
  }).sort((a, b) => nearby && userLocation ? (a.coordinates ? distanceKm(userLocation, a.coordinates) : Infinity) - (b.coordinates ? distanceKm(userLocation, b.coordinates) : Infinity) : 0), [pref, category, query, nearby, userLocation]);
  const selectStation = useCallback((s: Station) => setSelected(s), []);
  function toggleNearby() {
    if (nearby) { setNearby(false); return; }
    if (!navigator.geolocation) { setLocationError("この端末では位置情報を利用できません"); return; }
    setLocatingNearby(true); setLocationError("");
    navigator.geolocation.getCurrentPosition((p) => {
      setUserLocation([p.coords.latitude, p.coords.longitude]); setNearby(true); setLocatingNearby(false);
      setPref("すべて"); setCategory("すべて"); setQuery("");
    }, () => { setLocatingNearby(false); setLocationError("位置情報を許可すると近くの駅を表示できます"); }, { enableHighAccuracy: true, timeout: 12000, maximumAge: 60000 });
  }
  useEffect(() => {
    try {
      const rows = JSON.parse(localStorage.getItem(stampStorageKey) || "[]") as unknown;
      if (Array.isArray(rows)) setStampRows(rows.filter((x): x is StampRecord => typeof x === "object" && x !== null && typeof x.stationId === "string" && typeof x.stampedAt === "string"));
    } catch { /* 古い記録が読み込めない場合は空から始める */ }
  }, []);
  function toggleStamp(s: Station) {
    if (busy) return; setBusy(true); const undo = stamped.has(s.id);
    try {
      const next = undo ? stampRows.filter((x) => x.stationId !== s.id) : [...stampRows, { stationId: s.id, stampedAt: new Date().toISOString() }];
      localStorage.setItem(stampStorageKey, JSON.stringify(next));
      setStampRows(next);
      setMessage(undo ? "スタンプを取り消しました" : s.name + " のスタンプを獲得！");
    } catch { setMessage("この端末に保存できませんでした"); } finally { setBusy(false); window.setTimeout(() => setMessage(""), 3000); }
  }
  function chooseCategory(c: string) { setCategory(c); setTab("find"); }
  const pct = Math.round(stamped.size / stations.length * 100);
  const stampStations = visible.filter((s) => stampMode === "all" || (stampMode === "done" ? stamped.has(s.id) : !stamped.has(s.id)));
  const featured = stations.find((s) => s.id === "福14") || stations[0];
  return <main className="app-shell">
    <header className="topbar"><button className="logo-tile" onClick={() => setTab("find")} aria-label="ホーム"><Compass size={25}/></button><div className="brand"><small>KYUSHU QUEST</small><strong>道の駅を探す<span>✦</span></strong></div><button className="score-pill" onClick={() => setTab("stamps")}><Star size={17} fill="currentColor"/> {stamped.size}<span>/{stations.length}</span></button></header>
    {tab === "find" && <section className="page find-page">
      <div className="greeting"><div><span className="eyebrow">DISCOVER YOUR NEXT STOP</span><h1>次の寄り道、<br/><em>何を探す？</em></h1></div><img src="/quest-buddy.png" alt="九州クエストのキャラクター"/></div>
      <div className="search-field"><Search size={21}/><input value={query} onChange={(e) => setQuery(e.target.value)} placeholder="ソフト・名産・駅名で探す" aria-label="ソフト・名産・駅名で探す"/>{query && <button onClick={() => setQuery("")} aria-label="検索を消す"><X size={18}/></button>}</div>
      <button className={"nearby-button " + (nearby ? "active" : "")} onClick={toggleNearby} disabled={locatingNearby}><LocateFixed size={19}/><span>{locatingNearby ? "現在地を取得中…" : nearby ? "現在地から近い順で表示中" : "現在地から探す"}</span><small>{nearby ? "解除" : "近い駅から見る"}</small><ChevronRight size={16}/></button>
      {locationError && <p className="location-note">{locationError}</p>}
      {!query && category === "すべて" && <button className="hero-card" onClick={() => chooseCategory("ソフト")}><img src="/kyushu-quest-board.jpg" alt="九州の道の駅クエスト"/><span className="hero-label"><Sparkles size={13}/> 今週のおすすめ</span><span className="hero-caption"><small>KYUSHU QUEST / 01</small><b>ご当地ソフトを<br/>探そう！</b><span>九州ならではの味に出会う <ArrowRight size={17}/></span></span><span className="hero-medal"><Mascot id={featured.id} size={66}/></span></button>}
      <div className="section-head"><div><span>SEARCH BY CATEGORY</span><h2>何があるかな？</h2></div><Sparkles size={22}/></div>
      <div className="category-grid">{categories.slice(1).map((c) => <button className={"category-tile " + (category === c ? "active" : "")} style={{"--tile":categoryColors[c]} as React.CSSProperties} onClick={() => chooseCategory(category === c ? "すべて" : c)} key={c}><span>{c === "ソフト" ? "🍦" : c === "名産" ? "🎁" : c === "食事" ? "🍜" : c === "景色" ? "⛰️" : c === "体験" ? "🎯" : "🏠"}</span><b>{c}</b></button>)}</div>
      <div className="section-head results-head"><div><span>EXPLORE {pref === "すべて" ? "KYUSHU" : short[pref].toUpperCase()}</span><h2>{category === "すべて" ? "道の駅を見つける" : category + "のある道の駅"}</h2></div><span className="count-badge">{visible.length} 駅</span></div>
      <div className="pref-scroll">{prefs.map((p) => <button key={p} className={pref === p ? "active" : ""} onClick={() => setPref(p)}>{p === "すべて" ? "九州すべて" : short[p]}</button>)}</div>
      <div className="station-list">{visible.map((s) => <button className="station-card" key={s.id} onClick={() => selectStation(s)}><div className="station-card-photo"><Photo station={s}/><span className="pref-badge">{short[s.prefecture]}</span></div><div className="station-card-body"><div className="station-title-row"><b>{s.name}</b><Medal id={s.id} collected={stamped.has(s.id)} size={58}/></div><span className="station-address"><MapPin size={12}/>{s.address}</span>{nearby && userLocation && s.coordinates && <span className="distance-label"><LocateFixed size={11}/> 現在地から約 {distanceKm(userLocation,s.coordinates).toFixed(1)} km</span>}<div className="discovery-line">{(byStation.get(s.id) || []).slice(0,2).map((i) => <span key={i.title}>{i.title}</span>)}{!(byStation.get(s.id) || []).length && <span>{designs[s.id]?.motif}</span>}</div><span className="open-detail">駅をチェック <ChevronRight size={15}/></span></div></button>)}</div>
      {!visible.length && <div className="empty">見つかりませんでした。条件を変えてみてください。</div>}
      <p className="source-foot">写真・駅情報：国土交通省九州地方整備局の各駅ページをもとに整理・加工しています。出典は駅の詳細から確認できます。</p>
    </section>}
    {tab === "map" && <section className="page map-page"><div className="map-header"><span>EXPLORE THE MAP</span><h1>九州マップ <span>✦</span></h1><p>気になるピンをタップして、寄り道を見つけよう。</p></div><div className="search-field map-search"><Search size={19}/><input value={query} onChange={(e) => setQuery(e.target.value)} placeholder="駅名・ソフト・名産で検索"/>{query && <button onClick={() => setQuery("")}><X size={17}/></button>}</div><button className={"nearby-button map-nearby " + (nearby ? "active" : "")} onClick={toggleNearby} disabled={locatingNearby}><LocateFixed size={17}/><span>{locatingNearby ? "現在地を取得中…" : nearby ? "現在地から近い順" : "現在地から探す"}</span><ChevronRight size={15}/></button>{locationError && <p className="location-note">{locationError}</p>}<div className="pref-scroll">{prefs.map((p) => <button key={p} className={pref === p ? "active" : ""} onClick={() => setPref(p)}>{p === "すべて" ? "九州すべて" : short[p]}</button>)}</div><StationMap visible={visible} stamped={stamped} onSelect={selectStation} prefecture={pref} nearbyLocation={nearby ? userLocation : null}/></section>}
    {tab === "stamps" && <section className="page stamps-page"><div className="stamp-score"><div className="score-decor">✦ ★ ✦</div><span>KYUSHU STAMP RALLY</span><h1>{stamped.size}<small> / {stations.length} STAMPS</small></h1><div className="score-progress"><i style={{width:pct + "%"}}/></div><p>九州制覇まであと {stations.length - stamped.size} 駅 · {pct}%</p><Stamp className="score-watermark" size={116}/></div><div className="section-head"><div><span>YOUR COLLECTION</span><h2>スタンプ図鑑</h2></div><span className="count-badge">{stamped.size} GET!</span></div><div className="segmented"><button className={stampMode === "all" ? "active" : ""} onClick={() => setStampMode("all")}>すべて</button><button className={stampMode === "done" ? "active" : ""} onClick={() => setStampMode("done")}>獲得済み</button><button className={stampMode === "left" ? "active" : ""} onClick={() => setStampMode("left")}>これから</button></div><div className="pref-scroll">{prefs.map((p) => <button key={p} className={pref === p ? "active" : ""} onClick={() => setPref(p)}>{p === "すべて" ? "九州すべて" : short[p]}</button>)}</div><div className="stamp-grid">{stampStations.map((s) => <button key={s.id} className={"stamp-card " + (stamped.has(s.id) ? "earned" : "")} onClick={() => selectStation(s)}><Medal id={s.id} collected={stamped.has(s.id)} size={92}/><span className="stamp-id">{s.id}</span><strong>{designs[s.id]?.characterName}</strong><small>{s.name}</small><span className="stamp-status">{stamped.has(s.id) ? "GET!" : "？？？"}</span></button>)}</div></section>}
    {tab === "guide" && <section className="page guide-page"><div className="guide-cover"><BookOpen size={30}/><span>ROAD TRIP NOTES</span><h1>旅のガイド</h1><p>雑誌で見つけたグルメや体験から、次の寄り道へ。</p></div><div className="guide-stats"><div><b>{(rawMagazine as Discovery[]).length}</b><span>掲載アイテム</span></div><div><b>{guideStations.length}</b><span>掲載駅</span></div><div><b>{stations.length}</b><span>道の駅</span></div></div><div className="section-head"><div><span>FEATURED STOPS</span><h2>寄り道ノート</h2></div></div><div className="guide-feature-list">{guideStations.map((s) => <button key={s.id} className="guide-feature" onClick={() => selectStation(s)}><Photo station={s}/><span className="guide-feature-copy"><small>{short[s.prefecture]} · {s.id}</small><strong>{s.name}</strong><span>{(rawMagazine as Discovery[]).filter((d) => d.stationId === s.id).slice(0,3).map((d) => d.title).join(" / ")}</span><b>詳しく見る <ChevronRight size={14}/></b></span></button>)}</div><p className="source-foot">誌面画像は公開していません。掲載内容・営業時間は訪問前に公式情報をご確認ください。</p></section>}
    <nav className="bottom-nav" aria-label="メインメニュー">{([{id:"find",label:"さがす",icon:Search},{id:"map",label:"マップ",icon:MapPin},{id:"stamps",label:"スタンプ",icon:Stamp},{id:"guide",label:"ガイド",icon:BookOpen}] as const).map((item) => <button key={item.id} className={tab === item.id ? "active" : ""} onClick={() => {setTab(item.id); window.scrollTo({top:0,behavior:"smooth"});}}><item.icon size={22} strokeWidth={tab === item.id ? 2.8 : 2.2}/><span>{item.label}</span></button>)}</nav>
    {selected && <div className="modal-backdrop" onClick={() => setSelected(null)}><article className="station-sheet" role="dialog" aria-modal="true" aria-label={"道の駅 " + selected.name} onClick={(e) => e.stopPropagation()}><div className="sheet-handle"/><button className="sheet-close" onClick={() => setSelected(null)} aria-label="閉じる"><X size={20}/></button><div className="sheet-photo"><Photo station={selected}/><span className="sheet-pref">{short[selected.prefecture]} · {selected.id}</span></div><div className="sheet-body"><div className="sheet-title"><div><span>MICHI NO EKI QUEST</span><h2>{selected.name}</h2><p><MapPin size={14}/>{selected.address}</p></div><Medal id={selected.id} collected={stamped.has(selected.id)} size={92}/></div><div className="character-panel"><Mascot id={selected.id} size={74}/><div><small>この駅のキャラクター</small><strong>{designs[selected.id]?.characterName}</strong><span>{designs[selected.id]?.motif}がモチーフ</span></div></div><div className="sheet-actions"><a className="navigate-button" href={selected.directions} target="_blank" rel="noopener noreferrer"><Navigation size={18} fill="currentColor"/> Google マップで行く <ArrowRight size={17}/></a><button className={"stamp-button " + (stamped.has(selected.id) ? "stamped" : "")} disabled={busy} onClick={() => toggleStamp(selected)}><Stamp size={18}/>{stamped.has(selected.id) ? "スタンプ獲得済み" : "スタンプを押す"}</button></div><div className="section-head detail-head"><div><span>WHAT'S HERE?</span><h2>この駅で見つかるもの</h2></div></div><div className="discovery-list">{(byStation.get(selected.id) || []).map((i, index) => <div className="discovery-item" key={i.title + index}><span className="discovery-icon" style={{background:categoryColors[i.category] || "#6d96d8"}}>{i.category === "ソフト" ? "🍦" : i.category === "名産" ? "🎁" : i.category === "食事" ? "🍜" : i.category === "景色" ? "⛰️" : i.category === "体験" ? "🎯" : "🏠"}</span><div><small>{i.category} · {i.pageId ? "まっぷる掲載" : "公式掲載"}</small><strong>{i.title}</strong></div>{i.sourceUrl ? <a href={i.sourceUrl} target="_blank" rel="noopener noreferrer" aria-label="公式情報を開く"><ExternalLink size={18}/></a> : null}</div>)}{!(byStation.get(selected.id) || []).length && <div className="empty">この駅の個別情報は調査中です。</div>}</div><div className="detail-facts"><div><small>営業時間</small><strong>{selected.hours || "公式情報で確認"}</strong></div><div><small>定休日</small><strong>{selected.closed || "公式情報で確認"}</strong></div><div><small>アクセス</small><strong>{selected.access || selected.road || "公式情報で確認"}</strong></div>{selected.phone && <div><small>電話</small><a href={"tel:" + selected.phone.replace(/[^\d+]/g, "")}>{selected.phone}</a></div>}</div>{selected.alerts?.map((a) => <p className="station-alert" key={a}>{a}</p>)}<p className="source-foot">{selected.imageSource && <a href={selected.imageSource} target="_blank" rel="noopener noreferrer">写真・駅情報の出典：国土交通省九州地方整備局 <ExternalLink size={11}/></a>}<br/>掲載情報は整理・加工しています。営業時間等は訪問前に公式情報をご確認ください。スタンプはこの端末に保存されます。</p></div></article></div>}
    
    {message && <div className="toast" role="status">{message}</div>}
  </main>;
}
