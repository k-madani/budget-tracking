import Link from "next/link";

export default function HeroTagline() {
  return (
    <section className="hero section">
      <h1 style={{ margin: 0, fontSize: 28 }}>Welcome to Budget Tracker</h1>
      <p style={{ marginTop: 8, color: "var(--muted)", maxWidth: 720 }}>
        Track expenses, save smarter, and stay in control of your money. Categorize your spending and
        see income, expenses, and balance at a glance.
      </p>
      <div style={{ display: "flex", gap: 10, marginTop: 14 }}>
        <Link href="/transactions" className="btn btn-primary">Add a Transaction</Link>
        <Link href="/categories" className="btn">Create a Category</Link>
      </div>
    </section>
  );
}
