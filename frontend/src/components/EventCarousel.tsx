import { useEffect, useState } from "react";
import type { EventItem } from "../types";

const API_BASE = "http://127.0.0.1:5000";

interface Props { events: EventItem[]; onRegister?: (id: string) => void; }

export default function EventCarousel({ events, onRegister }: Props) {
  const [current, setCurrent] = useState(0);

  // Auto-slide every 4 seconds
  useEffect(() => {
    if (events.length < 2) return;
    const id = setInterval(() => setCurrent(c => (c + 1) % events.length), 4000);
    return () => clearInterval(id);
  }, [events.length]);

  if (!events.length) return null;

  const prev = () => setCurrent(c => (c - 1 + events.length) % events.length);
  const next = () => setCurrent(c => (c + 1) % events.length);

  return (
    <div className="carousel">
      <div className="carousel-track" style={{ transform: `translateX(-${current * 100}%)` }}>
        {events.map((e) => {
          const src = e.bannerImage
            ? (e.bannerImage.startsWith("/uploads") || !e.bannerImage.startsWith("http")
                ? `${API_BASE}${e.bannerImage}`
                : e.bannerImage)
            : "https://images.unsplash.com/photo-1540575467063-178a50c2df87?w=900";
          return (
            <div key={e._id} className="carousel-slide">
              <img src={src} alt={e.title} style={{ width: "100%", height: 300, objectFit: "cover" }} />
              <div className="carousel-overlay">
                <div style={{ display: "flex", gap: 8, marginBottom: 10 }}>
                  <span style={{ background: "linear-gradient(135deg,#4f46e5,#8b5cf6)", color: "#fff", borderRadius: 99, padding: "3px 12px", fontSize: "0.72rem", fontWeight: 700, textTransform: "capitalize" }}>{e.type}</span>
                  {e.isPaid && <span style={{ background: "rgba(5,150,105,0.85)", color: "#fff", borderRadius: 99, padding: "3px 12px", fontSize: "0.72rem", fontWeight: 700 }}>{e.price}</span>}
                </div>
                <h3 style={{ margin: "0 0 6px", fontSize: "1.4rem", fontWeight: 800, letterSpacing: "-0.025em" }}>{e.title}</h3>
                <div style={{ display: "flex", gap: 16, fontSize: "0.82rem", color: "rgba(255,255,255,0.75)", marginBottom: 14 }}>
                  <span> {new Date(e.date).toLocaleDateString("en-IN", { day: "numeric", month: "short", year: "numeric" })}</span>
                  {e.location && <span> {e.location}</span>}
                </div>
                {onRegister && (
                  <button type="button" onClick={() => onRegister(e._id)}
                    style={{ background: "linear-gradient(135deg,#4f46e5,#8b5cf6)", color: "#fff", border: 0, borderRadius: 10, padding: "9px 22px", fontWeight: 700, cursor: "pointer", fontSize: "0.875rem", boxShadow: "0 4px 14px rgba(79,70,229,0.5)" }}>
                    {e.isPaid ? ` Register  ${e.price}` : "Register Free"}
                  </button>
                )}
              </div>
            </div>
          );
        })}
      </div>

      {/* Prev/Next */}
      {events.length > 1 && (
        <>
          <button type="button" className="carousel-btn prev" onClick={prev} aria-label="Previous"></button>
          <button type="button" className="carousel-btn next" onClick={next} aria-label="Next"></button>
        </>
      )}

      {/* Dots */}
      {events.length > 1 && (
        <div className="carousel-dots" style={{ position: "absolute", bottom: 14, left: 0, right: 0, zIndex: 5 }}>
          {events.map((_, i) => (
            <button key={i} type="button" className={`carousel-dot${i === current ? " active" : ""}`} onClick={() => setCurrent(i)} aria-label={`Slide ${i + 1}`} />
          ))}
        </div>
      )}
    </div>
  );
}
