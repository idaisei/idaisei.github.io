import { useState, type FormEvent } from "react";
import { createRoot } from "react-dom/client";
import { ArrowRight, Compass, LockKeyhole, Sparkles } from "lucide-react";
import DriveApp from "./DriveApp";
import "./styles.css";
import "leaflet/dist/leaflet.css";

const gateKey = "kyushu-quest-entry-v1";
const emailDigest = "b6acf4f28ff1f35d523e02a2dfdf4e7ae8ec524866c54919babcb14b7110b835";

function App() {
  const [unlocked, setUnlocked] = useState(() => localStorage.getItem(gateKey) === "1");
  const [email, setEmail] = useState("");
  const [error, setError] = useState("");
  const [checking, setChecking] = useState(false);

  async function enter(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setChecking(true);
    setError("");
    try {
      const normalized = email.trim().toLocaleLowerCase();
      const bytes = new TextEncoder().encode(normalized);
      const hash = await crypto.subtle.digest("SHA-256", bytes);
      const hex = Array.from(new Uint8Array(hash), (b) => b.toString(16).padStart(2, "0")).join("");
      if (hex !== emailDigest) { setError("メールアドレスを確認してください"); return; }
      localStorage.setItem(gateKey, "1");
      setUnlocked(true);
    } catch { setError("このブラウザでは確認できませんでした"); }
    finally { setChecking(false); }
  }
  if (unlocked) return <DriveApp/>;
  return <main className="entry-shell">
    <div className="entry-stars" aria-hidden="true">✦　★　✦</div>
    <div className="entry-icon"><Compass size={33}/></div>
    <p className="entry-kicker">KYUSHU QUEST</p>
    <h1>九州の寄り道を、<br/><span>見つけに行こう。</span></h1>
    <img className="entry-buddy" src="/quest-buddy.png" alt="九州クエストのキャラクター"/>
    <form onSubmit={enter} className="entry-card">
      <div className="entry-tag"><Sparkles size={14}/> 旅のスタート地点</div>
      <label htmlFor="entry-email">メールアドレス</label>
      <input id="entry-email" type="email" inputMode="email" autoComplete="email" value={email} onChange={(e) => setEmail(e.target.value)} placeholder="メールアドレスを入力" required/>
      {error && <p className="entry-error" role="alert">{error}</p>}
      <button type="submit" disabled={checking}><LockKeyhole size={17}/>{checking ? "確認中…" : "クエストを始める"}<ArrowRight size={18}/></button>
    </form>
    <p className="entry-foot">KYUSHU 7 PREFECTURES · 146 STATIONS</p>
  </main>;
}

createRoot(document.getElementById("root")!).render(<App/>);
