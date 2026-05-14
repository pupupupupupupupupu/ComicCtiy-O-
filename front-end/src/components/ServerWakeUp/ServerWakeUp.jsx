import "./ServerWakeUp.css";
import { useState, useEffect, useRef, useCallback } from "react";
import axios from "axios";

const API            = process.env.REACT_APP_URL;
const POLL_INTERVAL  = 7000;   // re-check every 7 s
const EXPECTED_WAKE  = 50;     // Render free tier typically wakes in ~30-50 s
const INITIAL_TIMEOUT = 4000;  // how long to wait on the first check before showing UI

const ServerWakeUp = ({ children }) => {
  // "idle"     → haven't checked yet (first 4 s — avoid flash for fast servers)
  // "online"   → server responded
  // "waking"   → server didn't respond, showing wake-up screen
  const [phase,   setPhase]   = useState("idle");
  const [elapsed, setElapsed] = useState(0);

  const elapsedTimer = useRef(null);
  const pollTimer    = useRef(null);
  const mounted      = useRef(true);

  const stopTimers = () => {
    clearInterval(elapsedTimer.current);
    clearTimeout(pollTimer.current);
  };

  const markOnline = useCallback(() => {
    if (!mounted.current) return;
    stopTimers();
    setPhase("online");
  }, []);

  const scheduleNextPoll = useCallback(() => {
    pollTimer.current = setTimeout(async () => {
      if (!mounted.current) return;
      try {
        await axios.get(`${API}/api/health`, { timeout: 8000 });
        markOnline();
      } catch {
        scheduleNextPoll(); // keep retrying
      }
    }, POLL_INTERVAL);
  }, [markOnline]);

  useEffect(() => {
    mounted.current = true;

    const initialCheck = async () => {
      try {
        // Give the server INITIAL_TIMEOUT ms to respond before showing any UI
        await axios.get(`${API}/api/health`, { timeout: INITIAL_TIMEOUT });
        markOnline();
      } catch {
        if (!mounted.current) return;
        // Server didn't respond in time — show wake-up screen
        setPhase("waking");

        // Tick elapsed seconds
        elapsedTimer.current = setInterval(() => {
          setElapsed((s) => s + 1);
        }, 1000);

        // Keep polling until it's up
        scheduleNextPoll();
      }
    };

    initialCheck();

    return () => {
      mounted.current = false;
      stopTimers();
    };
  }, [markOnline, scheduleNextPoll]);

  // Server is confirmed online — render the app normally
  if (phase === "online" || phase === "idle") {
    // "idle" renders children too; if server is sleeping the individual
    // page fetches will fail and the wake-up will trigger.
    // We show the overlay only when we've confirmed it's sleeping.
    return children;
  }

  // ── Wake-up screen ────────────────────────────────────────────────────────
  const progress = Math.min((elapsed / EXPECTED_WAKE) * 100, 95); // cap at 95 until confirmed

  return (
    <div className="swOverlay">
      <div className="swCard">

        {/* Logo / brand */}
        <div className="swLogo">
          <svg width="48" height="48" viewBox="0 0 48 48" fill="none">
            <circle cx="24" cy="24" r="24" fill="rgba(124,110,245,0.12)"/>
            <path d="M14 16h8l4 5-4 5h-8l4-5-4-5z" fill="#7c6ef5" opacity="0.9"/>
            <path d="M26 16h8l4 5-4 5h-8l4-5-4-5z" fill="#a193f8" opacity="0.7"/>
            <rect x="14" y="28" width="20" height="3" rx="1.5" fill="#7c6ef5" opacity="0.5"/>
            <rect x="14" y="33" width="14" height="3" rx="1.5" fill="#7c6ef5" opacity="0.3"/>
          </svg>
          <span className="swLogoText">Comic City</span>
        </div>

        {/* Headline */}
        <h2 className="swTitle">Server is waking up…</h2>
        <p className="swSub">
          The server went to sleep after a period of inactivity.<br />
          This takes about <strong>30–50 seconds</strong> on free hosting.
        </p>

        {/* Progress bar */}
        <div className="swProgressTrack">
          <div className="swProgressBar" style={{ width: `${progress}%` }} />
        </div>

        {/* Timer */}
        <p className="swElapsed">
          {elapsed < EXPECTED_WAKE
            ? `Waiting… ${elapsed}s`
            : `Almost there… ${elapsed}s`}
        </p>

        {/* Animated dots */}
        <div className="swDots">
          <span /><span /><span />
        </div>

        {/* Explanation */}
        <p className="swNote">
          You won't need to do anything — the page will load automatically once
          the server responds.
        </p>
      </div>
    </div>
  );
};

export default ServerWakeUp;
