import "@/styles/ui.css";
import Link from "next/link";

export const metadata = { title: "Budget Tracker" };

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body>
        <header className="navbar header-bg">
          <div className="navbar-inner">
            <div className="brand">
              <span className="brand-mark">💸</span>
              <span style={{ color: "#fff" }}>Budget Tracker</span>
            </div>
            <nav className="nav">
              <Link href="/">Dashboard</Link>
              <Link href="/categories">Categories</Link>
              <Link href="/transactions">Transactions</Link>
              <Link href="/login">Login</Link>
            </nav>
          </div>
        </header>

        <div className="page">
          {children}
        </div>
      </body>
    </html>
  );
}
