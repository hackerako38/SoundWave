import { useState, useEffect, useRef, useCallback } from "react";

// ─── Firebase SDK (loaded via CDN in index) ───────────────────────────────────
// We'll import Firebase dynamically via script tags injected into head
// and expose them as window.firebase* globals.

// ─── CONSTANTS ────────────────────────────────────────────────────────────────
https://my-yt-ai-agent-dzj4wjk1q-hackerako38s-projects.vercel.app

// Internet Archive free/legal music collections
const IA_SEARCH_URL = "https://archive.org/advancedsearch.php";
const IA_DETAILS_URL = "https://archive.org/metadata";
const IA_STREAM_BASE = "https://archive.org/download";

// TheAudioDB free API (key 523532 is free tier)
const AUDIODB_BASE = "https://www.theaudiodb.com/api/v1/json/523532";

// Curated legal IA collections for browsing
const COLLECTIONS = [
  { id: "GratefulDead", label: "Grateful Dead Archive", color: "#e74c3c" },
  { id: "etree", label: "Live Music Archive", color: "#e67e22" },
  { id: "netlabels", label: "Net Labels (CC Music)", color: "#2ecc71" },
  { id: "audio_music", label: "Community Audio", color: "#3498db" },
  { id: "78rpm", label: "78rpm Records", color: "#9b59b6" },
];

// ─── FIREBASE LOADER ──────────────────────────────────────────────────────────
function loadFirebase() {
  return new Promise((resolve) => {
    if (window.__fbLoaded) return resolve();
    const scripts = [
      "https://www.gstatic.com/firebasejs/10.12.2/firebase-app-compat.js",
      "https://www.gstatic.com/firebasejs/10.12.2/firebase-auth-compat.js",
    ];
    let loaded = 0;
    scripts.forEach((src) => {
      const s = document.createElement("script");
      s.src = src;
      s.onload = () => { if (++loaded === scripts.length) { window.__fbLoaded = true; resolve(); } };
      document.head.appendChild(s);
    });
  });
}

// ─── HELPERS ──────────────────────────────────────────────────────────────────
function formatTime(s) {
  if (!s || isNaN(s)) return "0:00";
  const m = Math.floor(s / 60);
  const sec = Math.floor(s % 60).toString().padStart(2, "0");
  return `${m}:${sec}`;
}

function truncate(str, n) {
  return str && str.length > n ? str.slice(0, n) + "…" : str || "";
}

// ─── STYLES ───────────────────────────────────────────────────────────────────
const css = `
  @import url('https://fonts.googleapis.com/css2?family=Bebas+Neue&family=DM+Sans:wght@300;400;500;600&family=DM+Mono:wght@400;500&display=swap');

  *, *::before, *::after { box-sizing: border-box; margin: 0; padding: 0; }

  :root {
    --bg: #0a0a0f;
    --surface: #13131a;
    --surface2: #1c1c26;
    --border: #2a2a3a;
    --accent: #ff3d6e;
    --accent2: #7c3aed;
    --text: #e8e8f0;
    --muted: #6b6b85;
    --player-h: 88px;
    --sidebar-w: 240px;
  }

  html, body, #root { height: 100%; background: var(--bg); color: var(--text); font-family: 'DM Sans', sans-serif; overflow: hidden; }

  /* ── Scrollbar ── */
  ::-webkit-scrollbar { width: 4px; }
  ::-webkit-scrollbar-track { background: transparent; }
  ::-webkit-scrollbar-thumb { background: var(--border); border-radius: 2px; }

  /* ── Auth Screen ── */
  .auth-wrap {
    height: 100vh;
    display: flex;
    align-items: center;
    justify-content: center;
    background: radial-gradient(ellipse at 30% 20%, #1a0a2e 0%, var(--bg) 60%),
                radial-gradient(ellipse at 80% 80%, #1a0515 0%, transparent 50%);
  }
  .auth-card {
    width: 380px;
    background: var(--surface);
    border: 1px solid var(--border);
    border-radius: 20px;
    padding: 40px;
    display: flex;
    flex-direction: column;
    gap: 24px;
  }
  .auth-logo { font-family: 'Bebas Neue', sans-serif; font-size: 42px; letter-spacing: 3px; }
  .auth-logo span { color: var(--accent); }
  .auth-tagline { color: var(--muted); font-size: 14px; margin-top: -16px; }
  .auth-tabs { display: flex; border-bottom: 1px solid var(--border); }
  .auth-tab { flex: 1; padding: 10px; text-align: center; font-size: 14px; font-weight: 500; cursor: pointer; color: var(--muted); border-bottom: 2px solid transparent; transition: all .2s; }
  .auth-tab.active { color: var(--accent); border-color: var(--accent); }
  .auth-input {
    width: 100%;
    background: var(--surface2);
    border: 1px solid var(--border);
    border-radius: 10px;
    padding: 12px 16px;
    color: var(--text);
    font-family: 'DM Sans', sans-serif;
    font-size: 14px;
    outline: none;
    transition: border-color .2s;
  }
  .auth-input:focus { border-color: var(--accent2); }
  .auth-btn {
    width: 100%;
    padding: 14px;
    background: linear-gradient(135deg, var(--accent), var(--accent2));
    border: none;
    border-radius: 10px;
    color: #fff;
    font-family: 'DM Sans', sans-serif;
    font-size: 15px;
    font-weight: 600;
    cursor: pointer;
    transition: opacity .2s, transform .1s;
  }
  .auth-btn:hover { opacity: .9; }
  .auth-btn:active { transform: scale(.98); }
  .auth-btn:disabled { opacity: .5; cursor: not-allowed; }
  .auth-divider { text-align: center; color: var(--muted); font-size: 13px; position: relative; }
  .auth-divider::before, .auth-divider::after {
    content: ''; position: absolute; top: 50%; width: 40%; height: 1px; background: var(--border);
  }
  .auth-divider::before { left: 0; }
  .auth-divider::after { right: 0; }
  .google-btn {
    width: 100%;
    padding: 12px;
    background: var(--surface2);
    border: 1px solid var(--border);
    border-radius: 10px;
    color: var(--text);
    font-family: 'DM Sans', sans-serif;
    font-size: 14px;
    font-weight: 500;
    cursor: pointer;
    display: flex;
    align-items: center;
    justify-content: center;
    gap: 10px;
    transition: background .2s;
  }
  .google-btn:hover { background: var(--border); }
  .auth-error { color: var(--accent); font-size: 13px; text-align: center; background: rgba(255,61,110,.1); border-radius: 8px; padding: 8px; }

  /* ── App Layout ── */
  .app { display: grid; grid-template-columns: var(--sidebar-w) 1fr; grid-template-rows: 1fr var(--player-h); height: 100vh; }
  .sidebar { grid-row: 1; grid-column: 1; background: var(--surface); border-right: 1px solid var(--border); display: flex; flex-direction: column; overflow: hidden; }
  .main { grid-row: 1; grid-column: 2; overflow-y: auto; }
  .player-bar { grid-row: 2; grid-column: 1 / 3; background: var(--surface); border-top: 1px solid var(--border); }

  /* ── Sidebar ── */
  .sidebar-logo { padding: 24px 20px 16px; font-family: 'Bebas Neue', sans-serif; font-size: 28px; letter-spacing: 2px; }
  .sidebar-logo span { color: var(--accent); }
  .sidebar-section { padding: 8px 12px; font-size: 11px; font-weight: 600; letter-spacing: 1.5px; text-transform: uppercase; color: var(--muted); }
  .sidebar-item {
    display: flex; align-items: center; gap: 10px;
    padding: 10px 20px;
    font-size: 14px;
    font-weight: 500;
    cursor: pointer;
    border-radius: 0;
    color: var(--muted);
    transition: all .15s;
    border-left: 3px solid transparent;
  }
  .sidebar-item:hover { color: var(--text); background: rgba(255,255,255,.03); }
  .sidebar-item.active { color: var(--accent); border-color: var(--accent); background: rgba(255,61,110,.06); }
  .sidebar-collections { flex: 1; overflow-y: auto; padding: 4px 0 16px; }
  .collection-dot { width: 8px; height: 8px; border-radius: 50%; flex-shrink: 0; }
  .sidebar-bottom { padding: 16px 20px; border-top: 1px solid var(--border); display: flex; align-items: center; gap: 12px; }
  .user-avatar {
    width: 34px; height: 34px; border-radius: 50%;
    background: linear-gradient(135deg, var(--accent), var(--accent2));
    display: flex; align-items: center; justify-content: center;
    font-weight: 700; font-size: 13px; color: #fff; flex-shrink: 0;
  }
  .user-email { font-size: 12px; color: var(--muted); flex: 1; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
  .signout-btn { background: none; border: none; color: var(--muted); cursor: pointer; font-size: 18px; transition: color .2s; }
  .signout-btn:hover { color: var(--accent); }

  /* ── Main Content ── */
  .main-header { padding: 32px 32px 0; display: flex; align-items: center; justify-content: space-between; }
  .main-title { font-family: 'Bebas Neue', sans-serif; font-size: 40px; letter-spacing: 2px; }
  .main-subtitle { color: var(--muted); font-size: 14px; margin-top: 4px; }
  .search-wrap { padding: 20px 32px; position: sticky; top: 0; z-index: 10; background: var(--bg); }
  .search-box {
    width: 100%;
    background: var(--surface2);
    border: 1px solid var(--border);
    border-radius: 12px;
    padding: 12px 16px 12px 44px;
    color: var(--text);
    font-family: 'DM Sans', sans-serif;
    font-size: 15px;
    outline: none;
    transition: border-color .2s;
    position: relative;
  }
  .search-box:focus { border-color: var(--accent2); }
  .search-icon { position: absolute; left: 48px; top: 50%; transform: translateY(-50%); color: var(--muted); pointer-events: none; font-size: 18px; }
  .search-container { position: relative; }

  /* ── Track Grid ── */
  .tracks-grid { padding: 0 32px 120px; display: grid; grid-template-columns: repeat(auto-fill, minmax(180px, 1fr)); gap: 16px; }
  .track-card {
    background: var(--surface);
    border: 1px solid var(--border);
    border-radius: 14px;
    overflow: hidden;
    cursor: pointer;
    transition: transform .2s, border-color .2s, box-shadow .2s;
  }
  .track-card:hover { transform: translateY(-4px); border-color: var(--accent2); box-shadow: 0 8px 32px rgba(124,58,237,.2); }
  .track-card.playing { border-color: var(--accent); box-shadow: 0 8px 32px rgba(255,61,110,.25); }
  .track-art {
    width: 100%; aspect-ratio: 1;
    background: linear-gradient(135deg, var(--surface2), var(--border));
    display: flex; align-items: center; justify-content: center;
    font-size: 48px;
    position: relative;
    overflow: hidden;
  }
  .track-art img { width: 100%; height: 100%; object-fit: cover; position: absolute; inset: 0; }
  .track-art-overlay {
    position: absolute; inset: 0;
    background: rgba(0,0,0,.5);
    display: flex; align-items: center; justify-content: center;
    opacity: 0;
    transition: opacity .2s;
  }
  .track-card:hover .track-art-overlay { opacity: 1; }
  .track-card.playing .track-art-overlay { opacity: 1; background: rgba(255,61,110,.3); }
  .play-icon { font-size: 36px; color: #fff; filter: drop-shadow(0 2px 8px rgba(0,0,0,.5)); }
  .track-info { padding: 12px; }
  .track-name { font-size: 13px; font-weight: 600; color: var(--text); white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }
  .track-artist { font-size: 12px; color: var(--muted); margin-top: 3px; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }

  /* ── Player Bar ── */
  .player { height: 100%; display: grid; grid-template-columns: 280px 1fr 280px; align-items: center; padding: 0 24px; gap: 16px; }
  .player-track { display: flex; align-items: center; gap: 12px; min-width: 0; }
  .player-thumb {
    width: 54px; height: 54px; border-radius: 8px;
    background: linear-gradient(135deg, var(--surface2), var(--border));
    flex-shrink: 0; display: flex; align-items: center; justify-content: center;
    font-size: 22px; overflow: hidden; position: relative;
  }
  .player-thumb img { width: 100%; height: 100%; object-fit: cover; position: absolute; inset: 0; }
  .player-meta { min-width: 0; }
  .player-title { font-size: 14px; font-weight: 600; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }
  .player-artist { font-size: 12px; color: var(--muted); margin-top: 2px; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }
  .player-controls { display: flex; flex-direction: column; align-items: center; gap: 8px; }
  .player-btns { display: flex; align-items: center; gap: 16px; }
  .ctrl-btn { background: none; border: none; color: var(--muted); cursor: pointer; font-size: 22px; transition: color .2s, transform .1s; }
  .ctrl-btn:hover { color: var(--text); }
  .ctrl-btn.active { color: var(--accent); }
  .play-btn {
    width: 42px; height: 42px;
    background: linear-gradient(135deg, var(--accent), var(--accent2));
    border: none; border-radius: 50%;
    color: #fff; font-size: 18px;
    cursor: pointer;
    display: flex; align-items: center; justify-content: center;
    transition: transform .1s, opacity .2s;
    box-shadow: 0 4px 16px rgba(255,61,110,.4);
  }
  .play-btn:hover { transform: scale(1.08); }
  .play-btn:active { transform: scale(.95); }
  .progress-row { display: flex; align-items: center; gap: 10px; width: 100%; }
  .time-label { font-family: 'DM Mono', monospace; font-size: 11px; color: var(--muted); flex-shrink: 0; }
  .progress-track { flex: 1; height: 4px; background: var(--border); border-radius: 2px; cursor: pointer; position: relative; }
  .progress-fill { height: 100%; background: linear-gradient(90deg, var(--accent), var(--accent2)); border-radius: 2px; transition: width .1s linear; pointer-events: none; }
  .player-right { display: flex; align-items: center; justify-content: flex-end; gap: 12px; }
  .vol-slider { -webkit-appearance: none; width: 90px; height: 4px; border-radius: 2px; background: var(--border); outline: none; cursor: pointer; }
  .vol-slider::-webkit-slider-thumb { -webkit-appearance: none; width: 12px; height: 12px; border-radius: 50%; background: var(--text); }

  /* ── Loading / Empty ── */
  .loading { display: flex; align-items: center; justify-content: center; padding: 80px 32px; flex-direction: column; gap: 16px; color: var(--muted); }
  .spinner { width: 40px; height: 40px; border: 3px solid var(--border); border-top-color: var(--accent); border-radius: 50%; animation: spin .8s linear infinite; }
  @keyframes spin { to { transform: rotate(360deg); } }
  .empty { padding: 80px 32px; text-align: center; color: var(--muted); }
  .empty-icon { font-size: 48px; margin-bottom: 12px; }

  /* ── Waveform equalizer animation ── */
  .eq { display: flex; align-items: flex-end; gap: 2px; height: 16px; }
  .eq-bar { width: 3px; background: var(--accent); border-radius: 1px; animation: eq-bounce .6s ease-in-out infinite alternate; }
  .eq-bar:nth-child(2) { animation-delay: .15s; }
  .eq-bar:nth-child(3) { animation-delay: .3s; }
  @keyframes eq-bounce { from { height: 4px; } to { height: 14px; } }

  /* ── Section tags ── */
  .tag { display: inline-block; padding: 3px 10px; border-radius: 20px; font-size: 11px; font-weight: 600; letter-spacing: .5px; text-transform: uppercase; }
  .tag-cc { background: rgba(46,204,113,.15); color: #2ecc71; border: 1px solid rgba(46,204,113,.3); }

  /* ── Responsive notice ── */
  @media (max-width: 700px) {
    .app { grid-template-columns: 1fr; }
    .sidebar { display: none; }
    .player { grid-template-columns: 1fr; }
  }
`;

// ─── INTERNET ARCHIVE API ─────────────────────────────────────────────────────
async function searchIA(query, collection = "", rows = 30, start = 0) {
  let q = `mediatype:audio AND format:MP3`;
  if (query) q += ` AND (title:"${query}" OR creator:"${query}")`;
  if (collection) q += ` AND collection:${collection}`;

  const params = new URLSearchParams({
    q,
    fl: "identifier,title,creator,date,subject,description",
    sort: "downloads desc",
    rows,
    start,
    output: "json",
  });

  const res = await fetch(`${IA_SEARCH_URL}?${params}`);
  const data = await res.json();
  return data.response?.docs || [];
}

async function getIAFiles(identifier) {
  const res = await fetch(`${IA_DETAILS_URL}/${identifier}`);
  const data = await res.json();
  const files = data.files || [];
  // Find MP3s
  const mp3s = files
    .filter((f) => f.name?.toLowerCase().endsWith(".mp3") && !f.name.toLowerCase().includes("64kb"))
    .slice(0, 20)
    .map((f) => ({
      id: `${identifier}/${f.name}`,
      title: f.title || f.name.replace(/\.mp3$/i, ""),
      artist: f.creator || data.metadata?.creator?.[0] || "Unknown Artist",
      album: data.metadata?.title?.[0] || identifier,
      url: `${IA_STREAM_BASE}/${identifier}/${encodeURIComponent(f.name)}`,
      art: `https://archive.org/services/img/${identifier}`,
      duration: f.length,
      identifier,
      source: "Internet Archive",
      license: data.metadata?.licenseurl?.[0] || "See archive.org",
    }));
  return mp3s;
}

// ─── COMPONENTS ───────────────────────────────────────────────────────────────

function AuthScreen({ onAuth }) {
  const [mode, setMode] = useState("login");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [fbReady, setFbReady] = useState(false);

  useEffect(() => {
    loadFirebase().then(() => {
      if (!window.firebase.apps.length) {
        window.firebase.initializeApp(FIREBASE_CONFIG);
      }
      setFbReady(true);
    });
  }, []);

  const handleSubmit = async () => {
    if (!fbReady) return;
    setLoading(true);
    setError("");
    const auth = window.firebase.auth();
    try {
      let cred;
      if (mode === "login") {
        cred = await auth.signInWithEmailAndPassword(email, password);
      } else {
        cred = await auth.createUserWithEmailAndPassword(email, password);
      }
      onAuth(cred.user);
    } catch (e) {
      setError(e.message.replace("Firebase: ", "").replace(/ \(auth\/.*\)/, ""));
    } finally {
      setLoading(false);
    }
  };

  const handleGoogle = async () => {
    if (!fbReady) return;
    setLoading(true);
    setError("");
    try {
      const provider = new window.firebase.auth.GoogleAuthProvider();
      const cred = await window.firebase.auth().signInWithPopup(provider);
      onAuth(cred.user);
    } catch (e) {
      setError(e.message.replace("Firebase: ", "").replace(/ \(auth\/.*\)/, ""));
    } finally {
      setLoading(false);
    }
  };

  // Allow demo / guest usage without Firebase
  const handleGuest = () => {
    onAuth({ email: "guest@soundwave.local", displayName: "Guest", uid: "guest" });
  };

  return (
    <div className="auth-wrap">
      <div className="auth-card">
        <div>
          <div className="auth-logo">Sound<span>Wave</span></div>
          <div className="auth-tagline">Free, legal music streaming — powered by Internet Archive</div>
        </div>

        <div className="auth-tabs">
          {["login", "signup"].map((t) => (
            <div key={t} className={`auth-tab ${mode === t ? "active" : ""}`} onClick={() => setMode(t)}>
              {t === "login" ? "Sign In" : "Sign Up"}
            </div>
          ))}
        </div>

        {error && <div className="auth-error">{error}</div>}

        <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
          <input className="auth-input" type="email" placeholder="Email" value={email} onChange={(e) => setEmail(e.target.value)} />
          <input className="auth-input" type="password" placeholder="Password" value={password} onChange={(e) => setPassword(e.target.value)}
            onKeyDown={(e) => e.key === "Enter" && handleSubmit()} />
          <button className="auth-btn" onClick={handleSubmit} disabled={loading || !email || !password}>
            {loading ? "Please wait…" : mode === "login" ? "Sign In" : "Create Account"}
          </button>
        </div>

        <div className="auth-divider">or</div>

        <button className="google-btn" onClick={handleGoogle} disabled={loading}>
          <svg width="18" height="18" viewBox="0 0 48 48">
            <path fill="#EA4335" d="M24 9.5c3.54 0 6.71 1.22 9.21 3.6l6.85-6.85C35.9 2.38 30.47 0 24 0 14.62 0 6.51 5.38 2.56 13.22l7.98 6.19C12.43 13.72 17.74 9.5 24 9.5z"/>
            <path fill="#4285F4" d="M46.98 24.55c0-1.57-.15-3.09-.38-4.55H24v9.02h12.94c-.58 2.96-2.26 5.48-4.78 7.18l7.73 6c4.51-4.18 7.09-10.36 7.09-17.65z"/>
            <path fill="#FBBC05" d="M10.53 28.59c-.48-1.45-.76-2.99-.76-4.59s.27-3.14.76-4.59l-7.98-6.19C.92 16.46 0 20.12 0 24c0 3.88.92 7.54 2.56 10.78l7.97-6.19z"/>
            <path fill="#34A853" d="M24 48c6.48 0 11.93-2.13 15.89-5.81l-7.73-6c-2.15 1.45-4.92 2.3-8.16 2.3-6.26 0-11.57-4.22-13.47-9.91l-7.98 6.19C6.51 42.62 14.62 48 24 48z"/>
          </svg>
          Continue with Google
        </button>

        <button className="google-btn" onClick={handleGuest} style={{ opacity: .7, fontSize: 13 }}>
          🎵 Continue as Guest (no account needed)
        </button>

        <div style={{ fontSize: 11, color: "var(--muted)", textAlign: "center", lineHeight: 1.5 }}>
          Replace <code style={{ color: "var(--accent2)", fontSize: 10 }}>FIREBASE_CONFIG</code> at the top of the file with your Firebase project credentials to enable auth.
        </div>
      </div>
    </div>
  );
}

// ─── TRACK CARD ───────────────────────────────────────────────────────────────
function TrackCard({ track, isPlaying, onClick }) {
  const [artError, setArtError] = useState(false);

  return (
    <div className={`track-card ${isPlaying ? "playing" : ""}`} onClick={onClick}>
      <div className="track-art">
        {!artError && track.art ? (
          <img src={track.art} alt="" onError={() => setArtError(true)} />
        ) : (
          <span>🎵</span>
        )}
        <div className="track-art-overlay">
          {isPlaying ? (
            <div className="eq">
              <div className="eq-bar" />
              <div className="eq-bar" />
              <div className="eq-bar" />
            </div>
          ) : (
            <span className="play-icon">▶</span>
          )}
        </div>
      </div>
      <div className="track-info">
        <div className="track-name">{truncate(track.title, 40)}</div>
        <div className="track-artist">{truncate(track.artist, 30)}</div>
      </div>
    </div>
  );
}

// ─── PLAYER BAR ───────────────────────────────────────────────────────────────
function PlayerBar({ queue, currentIdx, playing, onPlayPause, onPrev, onNext, onSeek, audioRef }) {
  const [progress, setProgress] = useState(0);
  const [duration, setDuration] = useState(0);
  const [volume, setVolume] = useState(0.8);
  const [artError, setArtError] = useState(false);
  const track = queue[currentIdx];

  useEffect(() => {
    const audio = audioRef.current;
    if (!audio) return;
    const onTime = () => setProgress(audio.currentTime);
    const onDur = () => setDuration(audio.duration);
    audio.addEventListener("timeupdate", onTime);
    audio.addEventListener("durationchange", onDur);
    return () => { audio.removeEventListener("timeupdate", onTime); audio.removeEventListener("durationchange", onDur); };
  }, [audioRef]);

  useEffect(() => {
    if (audioRef.current) audioRef.current.volume = volume;
  }, [volume, audioRef]);

  useEffect(() => { setArtError(false); }, [track?.id]);

  if (!track) return (
    <div className="player" style={{ justifyContent: "center" }}>
      <div style={{ color: "var(--muted)", fontSize: 14 }}>Select a track to play</div>
    </div>
  );

  const pct = duration ? (progress / duration) * 100 : 0;

  const handleProgressClick = (e) => {
    const rect = e.currentTarget.getBoundingClientRect();
    const ratio = (e.clientX - rect.left) / rect.width;
    onSeek(ratio * duration);
  };

  return (
    <div className="player">
      {/* Left: track info */}
      <div className="player-track">
        <div className="player-thumb">
          {!artError && track.art ? (
            <img src={track.art} alt="" onError={() => setArtError(true)} />
          ) : "🎵"}
        </div>
        <div className="player-meta">
          <div className="player-title">{truncate(track.title, 35)}</div>
          <div className="player-artist">{truncate(track.artist, 30)}</div>
        </div>
      </div>

      {/* Center: controls + progress */}
      <div className="player-controls">
        <div className="player-btns">
          <button className="ctrl-btn" onClick={onPrev} title="Previous">⏮</button>
          <button className="play-btn" onClick={onPlayPause}>
            {playing ? "⏸" : "▶"}
          </button>
          <button className="ctrl-btn" onClick={onNext} title="Next">⏭</button>
        </div>
        <div className="progress-row">
          <span className="time-label">{formatTime(progress)}</span>
          <div className="progress-track" onClick={handleProgressClick}>
            <div className="progress-fill" style={{ width: `${pct}%` }} />
          </div>
          <span className="time-label">{formatTime(duration)}</span>
        </div>
      </div>

      {/* Right: volume */}
      <div className="player-right">
        <span style={{ fontSize: 16, color: "var(--muted)" }}>🔊</span>
        <input
          className="vol-slider"
          type="range" min="0" max="1" step="0.01"
          value={volume}
          onChange={(e) => setVolume(parseFloat(e.target.value))}
          style={{ background: `linear-gradient(90deg, var(--text) ${volume * 100}%, var(--border) ${volume * 100}%)` }}
        />
        <span style={{ fontSize: 12, color: "var(--muted)", width: 32, textAlign: "right" }}>
          {Math.round(volume * 100)}%
        </span>
      </div>
    </div>
  );
}

// ─── MAIN APP ─────────────────────────────────────────────────────────────────
function App() {
  const [user, setUser] = useState(null);
  const [view, setView] = useState("browse");
  const [activeCollection, setActiveCollection] = useState(COLLECTIONS[2]); // netlabels (CC music)
  const [items, setItems] = useState([]); // IA search results (identifiers)
  const [queue, setQueue] = useState([]);
  const [currentIdx, setCurrentIdx] = useState(-1);
  const [playing, setPlaying] = useState(false);
  const [loadingTracks, setLoadingTracks] = useState(false);
  const [loadingFiles, setLoadingFiles] = useState(false);
  const [search, setSearch] = useState("");
  const [searchTerm, setSearchTerm] = useState("");
  const audioRef = useRef(new Audio());

  // ── Audio events
  useEffect(() => {
    const audio = audioRef.current;
    const onEnded = () => handleNext();
    audio.addEventListener("ended", onEnded);
    return () => audio.removeEventListener("ended", onEnded);
  }, [currentIdx, queue]);

  useEffect(() => {
    const audio = audioRef.current;
    if (queue[currentIdx]) {
      if (audio.src !== queue[currentIdx].url) {
        audio.src = queue[currentIdx].url;
        audio.load();
      }
      if (playing) audio.play().catch(() => {});
      else audio.pause();
    }
  }, [currentIdx, queue]);

  useEffect(() => {
    if (playing) audioRef.current.play().catch(() => {});
    else audioRef.current.pause();
  }, [playing]);

  // ── Load collection
  useEffect(() => {
    loadCollection();
  }, [activeCollection, searchTerm]);

  async function loadCollection() {
    setLoadingTracks(true);
    setItems([]);
    setQueue([]);
    try {
      const docs = await searchIA(searchTerm, activeCollection.id, 24);
      setItems(docs);
    } catch (e) {
      console.error(e);
    } finally {
      setLoadingTracks(false);
    }
  }

  // ── Click album → load files → play first
  async function handleItemClick(doc) {
    setLoadingFiles(true);
    try {
      const tracks = await getIAFiles(doc.identifier);
      if (tracks.length) {
        setQueue(tracks);
        setCurrentIdx(0);
        setPlaying(true);
      }
    } catch (e) {
      console.error(e);
    } finally {
      setLoadingFiles(false);
    }
  }

  function handleTrackClick(idx) {
    if (idx === currentIdx) {
      setPlaying((p) => !p);
    } else {
      setCurrentIdx(idx);
      setPlaying(true);
    }
  }

  function handleNext() {
    if (currentIdx < queue.length - 1) setCurrentIdx((i) => i + 1);
    else setCurrentIdx(0);
    setPlaying(true);
  }

  function handlePrev() {
    if (currentIdx > 0) setCurrentIdx((i) => i - 1);
    else setCurrentIdx(queue.length - 1);
    setPlaying(true);
  }

  function handleSeek(t) {
    audioRef.current.currentTime = t;
  }

  function handleSignOut() {
    if (window.firebase?.auth) window.firebase.auth().signOut().catch(() => {});
    setUser(null);
    setQueue([]);
    setCurrentIdx(-1);
    setPlaying(false);
    audioRef.current.pause();
    audioRef.current.src = "";
  }

  if (!user) return <AuthScreen onAuth={setUser} />;

  const initials = (user.email || "G").slice(0, 1).toUpperCase();

  return (
    <div className="app">
      {/* ── Sidebar ── */}
      <aside className="sidebar">
        <div className="sidebar-logo">Sound<span>Wave</span></div>

        <div className="sidebar-section">Browse</div>
        {["browse", "queue"].map((v) => (
          <div key={v} className={`sidebar-item ${view === v ? "active" : ""}`} onClick={() => setView(v)}>
            <span>{v === "browse" ? "🎵" : "📋"}</span>
            {v === "browse" ? "Discover" : "Queue"}
          </div>
        ))}

        <div className="sidebar-section" style={{ marginTop: 8 }}>Collections</div>
        <div className="sidebar-collections">
          {COLLECTIONS.map((c) => (
            <div
              key={c.id}
              className={`sidebar-item ${activeCollection.id === c.id ? "active" : ""}`}
              onClick={() => { setActiveCollection(c); setView("browse"); }}
            >
              <span className="collection-dot" style={{ background: c.color }} />
              {c.label}
            </div>
          ))}
        </div>

        <div className="sidebar-bottom">
          <div className="user-avatar">{initials}</div>
          <div className="user-email">{user.email}</div>
          <button className="signout-btn" onClick={handleSignOut} title="Sign out">⏏</button>
        </div>
      </aside>

      {/* ── Main ── */}
      <main className="main">
        {view === "browse" && (
          <>
            <div className="main-header">
              <div>
                <div className="main-title">{activeCollection.label}</div>
                <div className="main-subtitle">
                  Free, legal music from the Internet Archive &nbsp;
                  <span className="tag tag-cc">Creative Commons</span>
                </div>
              </div>
            </div>

            <div className="search-wrap">
              <div className="search-container">
                <span className="search-icon">🔍</span>
                <input
                  className="search-box"
                  placeholder="Search artists, albums, titles…"
                  value={search}
                  onChange={(e) => setSearch(e.target.value)}
                  onKeyDown={(e) => e.key === "Enter" && setSearchTerm(search)}
                />
              </div>
            </div>

            {loadingTracks ? (
              <div className="loading"><div className="spinner" /><span>Loading music…</span></div>
            ) : loadingFiles ? (
              <div className="loading"><div className="spinner" /><span>Loading tracks…</span></div>
            ) : items.length === 0 ? (
              <div className="empty"><div className="empty-icon">🎸</div><div>No results found. Try a different search.</div></div>
            ) : (
              <div className="tracks-grid">
                {items.map((doc) => {
                  const isPlaying = queue[currentIdx]?.identifier === doc.identifier && playing;
                  return (
                    <TrackCard
                      key={doc.identifier}
                      track={{
                        id: doc.identifier,
                        title: doc.title || doc.identifier,
                        artist: Array.isArray(doc.creator) ? doc.creator[0] : (doc.creator || "Unknown"),
                        art: `https://archive.org/services/img/${doc.identifier}`,
                      }}
                      isPlaying={isPlaying}
                      onClick={() => handleItemClick(doc)}
                    />
                  );
                })}
              </div>
            )}
          </>
        )}

        {view === "queue" && (
          <>
            <div className="main-header">
              <div>
                <div className="main-title">Queue</div>
                <div className="main-subtitle">{queue.length} track{queue.length !== 1 ? "s" : ""}</div>
              </div>
            </div>
            {queue.length === 0 ? (
              <div className="empty"><div className="empty-icon">📋</div><div>Your queue is empty. Browse and play an album to get started.</div></div>
            ) : (
              <div style={{ padding: "16px 32px 120px", display: "flex", flexDirection: "column", gap: 4 }}>
                {queue.map((t, i) => (
                  <div
                    key={t.id}
                    onClick={() => handleTrackClick(i)}
                    style={{
                      display: "flex", alignItems: "center", gap: 14,
                      padding: "10px 14px", borderRadius: 10, cursor: "pointer",
                      background: i === currentIdx ? "rgba(255,61,110,.1)" : "transparent",
                      border: `1px solid ${i === currentIdx ? "var(--accent)" : "transparent"}`,
                      transition: "all .15s",
                    }}
                  >
                    <span style={{ width: 24, textAlign: "right", fontSize: 13, color: "var(--muted)", fontFamily: "DM Mono" }}>
                      {i === currentIdx && playing ? (
                        <span style={{ color: "var(--accent)" }}>▶</span>
                      ) : i + 1}
                    </span>
                    <div style={{ flex: 1, minWidth: 0 }}>
                      <div style={{ fontSize: 14, fontWeight: i === currentIdx ? 600 : 400, color: i === currentIdx ? "var(--accent)" : "var(--text)", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                        {truncate(t.title, 60)}
                      </div>
                      <div style={{ fontSize: 12, color: "var(--muted)", marginTop: 2 }}>{truncate(t.artist, 40)}</div>
                    </div>
                    {t.duration && <span style={{ fontSize: 12, color: "var(--muted)", fontFamily: "DM Mono", flexShrink: 0 }}>{formatTime(t.duration)}</span>}
                  </div>
                ))}
              </div>
            )}
          </>
        )}
      </main>

      {/* ── Player ── */}
      <div className="player-bar">
        <PlayerBar
          queue={queue}
          currentIdx={currentIdx}
          playing={playing}
          onPlayPause={() => setPlaying((p) => !p)}
          onPrev={handlePrev}
          onNext={handleNext}
          onSeek={handleSeek}
          audioRef={audioRef}
        />
      </div>

      <style>{css}</style>
    </div>
  );
}

export default App;
