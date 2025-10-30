"use client";

import { useEffect, useRef, useState } from "react";

const SLIDES = [
  { id: 1, className: "slide alt-1" },
  { id: 2, className: "slide alt-2" },
  { id: 3, className: "slide alt-3" },
];

export default function Carousel() {
  const [index, setIndex] = useState(0);
  const timer = useRef<NodeJS.Timeout | null>(null);

  const next = () => setIndex((i) => (i + 1) % SLIDES.length);
  const prev = () => setIndex((i) => (i - 1 + SLIDES.length) % SLIDES.length);

  useEffect(() => {
    timer.current && clearInterval(timer.current);
    timer.current = setInterval(next, 4500);
    return () => { timer.current && clearInterval(timer.current); };
  }, []);

  return (
    <div className="carousel">
      {SLIDES.map((s, i) => (
        <div key={s.id} className={`${s.className} ${i === index ? "visible" : ""}`} />
      ))}

      {/* Dark overlay + centered tagline/cta */}
      <div className="carousel-overlay">
        <div className="hero-copy">
          <h1>Take control of your money</h1>
          <p className="hero-sub">
            Track income and expenses, categorize spending, and see your balance clearly — all in one place.
          </p>
          <div style={{ display: "flex", gap: 10, marginTop: 16 }}>
            <a href="/transactions" className="btn btn-primary">Add a Transaction</a>
            <a href="/categories" className="btn">Create a Category</a>
          </div>
        </div>
      </div>

      {/* Controls */}
      <div className="carousel-controls" aria-hidden="true">
        <button aria-label="Previous slide" className="ctrl" onClick={prev}>‹</button>
        <button aria-label="Next slide" className="ctrl" onClick={next}>›</button>
      </div>
    </div>
  );
}
