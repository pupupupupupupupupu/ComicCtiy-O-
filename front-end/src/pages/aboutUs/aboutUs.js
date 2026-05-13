import { useEffect, useRef } from "react";
import { Link } from "react-router-dom";
import "./aboutUs.css";

/* ══════════════════════════════════════════════════════════════════════════
   PHYSICS CANVAS — floating comic panels with mild gravity + bounce
   ══════════════════════════════════════════════════════════════════════════ */
const PALETTE = ["#7c6ef5","#a193f8","#40c97e","#ede9ff","#d4f5e5","#5b4fd8","#c4b8ff"];

const SYMBOLS = ["!", "?", "★", "♦", "✦", "◆", "⚡", "☆", "◉"];

function randomBetween(a, b) { return a + Math.random() * (b - a); }

class Panel {
  constructor(w, h) {
    this.reset(w, h, true);
  }
  reset(W, H, init = false) {
    this.w   = randomBetween(48, 110);
    this.h   = randomBetween(60, 130);
    this.x   = init ? randomBetween(0, W - this.w) : -this.w - 10;
    this.y   = init ? randomBetween(0, H - this.h) : randomBetween(20, H * 0.8);
    this.vx  = randomBetween(0.3, 1.1) * (Math.random() < 0.5 ? 1 : -1);
    this.vy  = randomBetween(-0.4, 0.4);
    this.rot = randomBetween(-25, 25);       // degrees
    this.vr  = randomBetween(-0.35, 0.35);  // rotation speed
    this.col = PALETTE[Math.floor(Math.random() * PALETTE.length)];
    this.alpha= randomBetween(0.45, 0.88);
    this.sym = SYMBOLS[Math.floor(Math.random() * SYMBOLS.length)];
    this.hasInner = Math.random() > 0.4;
    // Depth effect
    this.depth = randomBetween(0.5, 1.0);
  }
  update(W, H) {
    this.x   += this.vx * this.depth;
    this.y   += this.vy;
    this.rot += this.vr;
    // Very mild float gravity
    this.vy += 0.005;
    this.vy *= 0.995;
    // Bounce off walls
    if (this.x + this.w > W && this.vx > 0) this.vx *= -1;
    if (this.x < 0           && this.vx < 0) this.vx *= -1;
    if (this.y + this.h > H  && this.vy > 0) { this.vy *= -0.65; this.vr *= 0.9; }
    if (this.y < 0           && this.vy < 0) this.vy *= -0.65;
  }
  draw(ctx) {
    ctx.save();
    ctx.translate(this.x + this.w / 2, this.y + this.h / 2);
    ctx.rotate((this.rot * Math.PI) / 180);
    ctx.globalAlpha = this.alpha * this.depth;

    // Panel body
    ctx.fillStyle   = this.col;
    ctx.strokeStyle = "rgba(255,255,255,0.35)";
    ctx.lineWidth   = 2;
    const r = 7;
    ctx.beginPath();
    ctx.roundRect(-this.w/2, -this.h/2, this.w, this.h, r);
    ctx.fill();
    ctx.stroke();

    // Inner panel lines (comic style)
    if (this.hasInner) {
      ctx.strokeStyle = "rgba(255,255,255,0.2)";
      ctx.lineWidth = 1;
      ctx.beginPath();
      ctx.roundRect(-this.w/2 + 5, -this.h/2 + 5, this.w - 10, this.h - 10, r - 2);
      ctx.stroke();
    }

    // Symbol
    ctx.fillStyle = "rgba(255,255,255,0.7)";
    ctx.font = `bold ${Math.round(this.w * 0.38)}px Bangers, cursive`;
    ctx.textAlign    = "center";
    ctx.textBaseline = "middle";
    ctx.fillText(this.sym, 0, 0);

    ctx.restore();
  }
}

class Bubble {
  constructor(W, H) { this.reset(W, H, true); }
  reset(W, H, init = false) {
    this.r  = randomBetween(20, 44);
    this.x  = init ? randomBetween(this.r, W - this.r) : randomBetween(this.r, W - this.r);
    this.y  = init ? randomBetween(this.r, H - this.r) : H + this.r;
    this.vx = randomBetween(-0.5, 0.5);
    this.vy = randomBetween(-0.7, -0.3);
    this.col= Math.random() > 0.5 ? "#ede9ff" : "#d4f5e5";
    this.alpha = randomBetween(0.35, 0.7);
    this.sym= SYMBOLS[Math.floor(Math.random() * SYMBOLS.length)];
  }
  update(W, H) {
    this.x += this.vx;
    this.y += this.vy;
    if (this.x - this.r < 0 || this.x + this.r > W) this.vx *= -1;
    if (this.y + this.r < 0) this.reset(W, H);
  }
  draw(ctx) {
    ctx.save();
    ctx.globalAlpha = this.alpha;
    // Bubble body
    ctx.beginPath();
    ctx.arc(this.x, this.y, this.r, 0, Math.PI * 2);
    ctx.fillStyle = this.col;
    ctx.fill();
    ctx.strokeStyle = "rgba(124,110,245,0.4)";
    ctx.lineWidth = 1.5;
    ctx.stroke();
    // Tail
    ctx.beginPath();
    ctx.moveTo(this.x - this.r * 0.3, this.y + this.r * 0.8);
    ctx.lineTo(this.x + this.r * 0.4, this.y + this.r * 1.35);
    ctx.lineTo(this.x + this.r * 0.1, this.y + this.r * 0.9);
    ctx.fillStyle = this.col;
    ctx.fill();
    // Symbol
    ctx.fillStyle = "#7c6ef5";
    ctx.font = `bold ${Math.round(this.r * 0.9)}px Bangers, cursive`;
    ctx.textAlign = "center"; ctx.textBaseline = "middle";
    ctx.fillText(this.sym, this.x, this.y - 1);
    ctx.restore();
  }
}

const PhysicsCanvas = () => {
  const canvasRef = useRef(null);
  const rafRef    = useRef(null);
  const objects   = useRef([]);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d");

    const resize = () => {
      canvas.width  = canvas.offsetWidth;
      canvas.height = canvas.offsetHeight;
    };

    const init = () => {
      resize();
      const W = canvas.width, H = canvas.height;
      objects.current = [
        ...Array.from({ length: 7 },  () => new Panel(W, H)),
        ...Array.from({ length: 5 },  () => new Bubble(W, H)),
      ];
    };

    const loop = () => {
      const W = canvas.width, H = canvas.height;
      ctx.clearRect(0, 0, W, H);

      // Background grid lines (comic page feel)
      ctx.strokeStyle = "rgba(124,110,245,0.06)";
      ctx.lineWidth   = 1;
      for (let x = 0; x < W; x += 60) { ctx.beginPath(); ctx.moveTo(x, 0); ctx.lineTo(x, H); ctx.stroke(); }
      for (let y = 0; y < H; y += 60) { ctx.beginPath(); ctx.moveTo(0, y); ctx.lineTo(W, y); ctx.stroke(); }

      objects.current.forEach((obj) => {
        obj.update(W, H);
        obj.draw(ctx);
      });

      rafRef.current = requestAnimationFrame(loop);
    };

    init();
    loop();

    const observer = new ResizeObserver(() => { resize(); });
    observer.observe(canvas);

    return () => {
      cancelAnimationFrame(rafRef.current);
      observer.disconnect();
    };
  }, []);

  return <canvas ref={canvasRef} className="physicsCanvas" />;
};

/* ══════════════════════════════════════════════════════════════════════════
   FEATURE CARD
   ══════════════════════════════════════════════════════════════════════════ */
const Feature = ({ icon, title, desc }) => (
  <div className="featureCard">
    <div className="featureIcon">{icon}</div>
    <h3 className="featureTitle">{title}</h3>
    <p className="featureDesc">{desc}</p>
  </div>
);

/* ══════════════════════════════════════════════════════════════════════════
   ABOUT US PAGE
   ══════════════════════════════════════════════════════════════════════════ */
const AboutUs = () => (
  <div className="aboutPage">
    {/* ── Hero ── */}
    <section className="aboutHero">
      <div className="heroCanvas">
        <PhysicsCanvas />
      </div>
      <div className="heroContent">
        <p className="heroEyebrow">Welcome to the universe of</p>
        <h1 className="heroTitle">Comic City</h1>
        <p className="heroSub">
          A platform built by readers, for readers — where every panel tells a story
          and every story finds its audience.
        </p>
        <div className="heroCtas">
          <Link to="/comics" className="btn btn-primary">Explore Comics</Link>
          <Link to="/upload" className="btn btn-secondary">Share Your Work</Link>
        </div>
      </div>
    </section>

    {/* ── Mission ── */}
    <section className="aboutSection missionSection">
      <div className="sectionInner">
        <span className="sectionEyebrow">Our Mission</span>
        <h2 className="sectionHeading">Comics deserve a better home.</h2>
        <p className="sectionBody">
          Comic City was born from a simple frustration: great comics get lost in the noise.
          We built a space where independent artists can publish freely, readers can discover
          genuinely, and communities can form organically — without algorithms burying the
          good stuff.
        </p>
        <p className="sectionBody">
          Every feature on this platform — from IP-based view tracking to public collections,
          chapter-by-chapter uploads, and artist follow pages — was designed with one goal:
          make the relationship between creator and reader feel real.
        </p>
      </div>
      <div className="missionAccent">
        <div className="accentPanel p1">Panel 1</div>
        <div className="accentPanel p2">Panel 2</div>
        <div className="accentPanel p3">★</div>
      </div>
    </section>

    {/* ── Features ── */}
    <section className="aboutSection featuresSection">
      <div className="sectionInner centered">
        <span className="sectionEyebrow">What We Offer</span>
        <h2 className="sectionHeading">Everything a comic platform should be.</h2>
      </div>
      <div className="featuresGrid">
        <Feature icon="📖" title="Chapter-by-Chapter"
          desc="Upload full comic runs chapter by chapter. Readers track where they left off with automatic continue-reading history." />
        <Feature icon="🎨" title="Artist Pages"
          desc="Every artist gets their own page. Follow your favourites and get a curated view of their entire catalogue." />
        <Feature icon="📚" title="Personal Collections"
          desc="Bookmark comics into named collections — make them public to share taste, or keep them private for yourself." />
        <Feature icon="💬" title="Real Conversations"
          desc="Comment, reply, and react. Creators can moderate their space with a fair daily allowance — no moderation chaos." />
        <Feature icon="🔥" title="Honest Popularity"
          desc="Weekly charts powered by IP-deduplicated view counts. No gaming, no bots — just real reader interest." />
        <Feature icon="🔍" title="Deep Search"
          desc="Search by title, artist, genre tags, or synopsis. Find exactly what you're in the mood for in seconds." />
      </div>
    </section>

    {/* ── How it works ── */}
    <section className="aboutSection howSection">
      <div className="sectionInner centered">
        <span className="sectionEyebrow">How It Works</span>
        <h2 className="sectionHeading">Three steps. No friction.</h2>
      </div>
      <div className="howSteps">
        {[
          { n: "01", title: "Sign Up",    desc: "One click with your existing Google or social account. Your profile is ready instantly." },
          { n: "02", title: "Discover",   desc: "Browse the home feed, search by genre or artist, or jump into the weekly popular chart." },
          { n: "03", title: "Engage",     desc: "Like, bookmark, comment, follow artists, and upload your own work — all in one place." },
        ].map((s) => (
          <div key={s.n} className="howStep">
            <div className="howNum">{s.n}</div>
            <h3 className="howTitle">{s.title}</h3>
            <p className="howDesc">{s.desc}</p>
          </div>
        ))}
      </div>
    </section>

    {/* ── CTA ── */}
    <section className="aboutSection ctaSection">
      <div className="ctaInner">
        <h2 className="ctaHeading">Ready to dive in?</h2>
        <p className="ctaSub">Join thousands of readers and creators who call Comic City home.</p>
        <Link to="/" className="btn btn-primary ctaBtn">Start Reading</Link>
      </div>
    </section>
  </div>
);

export default AboutUs;
