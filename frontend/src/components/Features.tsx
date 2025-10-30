function Feature({ icon, title, desc }: { icon: string; title: string; desc: string }) {
  return (
    <div className="card card-pad" style={{ display: "grid", gap: 6 }}>
      <div style={{ fontSize: 22 }}>{icon}</div>
      <div style={{ fontWeight: 600 }}>{title}</div>
      <div style={{ color: "var(--muted)", fontSize: 14 }}>{desc}</div>
    </div>
  );
}

export default function Features() {
  return (
    <section className="section grid grid-4">
      <Feature icon="💰" title="Track Expenses" desc="Log daily spending and income with a few clicks." />
      <Feature icon="🗂️" title="Categorize" desc="Organize by category to see where money flows." />
      <Feature icon="📊" title="Insights" desc="Totals and balance help you spot trends fast." />
      <Feature icon="🔔" title="Stay Informed" desc="Monthly summaries and charts (coming soon)." />
    </section>
  );
}
