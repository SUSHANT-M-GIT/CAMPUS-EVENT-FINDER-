/** Skeleton loader for event cards */
export function SkeletonCard() {
  return (
    <div style={{ borderRadius: 14, overflow: "hidden", background: "var(--surface-2)", border: "1px solid #f3f4f6" }}>
      <div className="skeleton" style={{ height: 172 }} />
      <div style={{ padding: "18px" }}>
        <div className="skeleton skeleton-line" style={{ width: "80%", marginBottom: 10 }} />
        <div className="skeleton skeleton-line" style={{ width: "60%", marginBottom: 10 }} />
        <div className="skeleton skeleton-line" style={{ width: "70%", marginBottom: 14 }} />
        <div className="skeleton" style={{ height: 36, borderRadius: 10 }} />
      </div>
    </div>
  );
}

/** Skeleton for a stat card */
export function SkeletonStat() {
  return (
    <div style={{ background: "var(--surface-2)", borderRadius: 14, padding: "22px 20px", border: "1px solid #f3f4f6", display: "flex", gap: 16, alignItems: "center" }}>
      <div className="skeleton skeleton-avatar" />
      <div style={{ flex: 1 }}>
        <div className="skeleton skeleton-line" style={{ width: "50%", height: 28, marginBottom: 8 }} />
        <div className="skeleton skeleton-line short" />
      </div>
    </div>
  );
}

/** Skeleton for a list row */
export function SkeletonRow() {
  return (
    <div style={{ display: "flex", gap: 12, padding: "14px 0", borderBottom: "1px solid #f3f4f6", alignItems: "center" }}>
      <div className="skeleton skeleton-avatar" style={{ width: 40, height: 40 }} />
      <div style={{ flex: 1 }}>
        <div className="skeleton skeleton-line medium" style={{ marginBottom: 6 }} />
        <div className="skeleton skeleton-line short" />
      </div>
      <div className="skeleton" style={{ width: 80, height: 28, borderRadius: 8 }} />
    </div>
  );
}
