'use client';

import Link from 'next/link';
import { useState, useEffect } from 'react';

export default function LandingPage() {
  const [isDark, setIsDark] = useState(false);
  const [balance, setBalance] = useState(1340);
  const [income, setIncome] = useState(3557);
  const [expenses, setExpenses] = useState(2273);
  const [mousePosition, setMousePosition] = useState({ x: 0, y: 0 });
  const [hoveredFeature, setHoveredFeature] = useState<number | null>(null);

  useEffect(() => {
    if (window.matchMedia('(prefers-color-scheme: dark)').matches) {
      setIsDark(true);
      document.documentElement.classList.add('dark');
    }

    const interval = setInterval(() => {
      setIncome(prev => Math.round(prev + (Math.random() * 100 - 50)));
      setExpenses(prev => Math.round(prev + (Math.random() * 50 - 25)));
      setBalance(prev => Math.round(prev + (Math.random() * 60 - 30)));
    }, 4000);

    return () => clearInterval(interval);
  }, []);

  const handleMouseMove = (e: React.MouseEvent) => {
    setMousePosition({ 
      x: (e.clientX / window.innerWidth) * 100, 
      y: (e.clientY / window.innerHeight) * 100 
    });
  };

  const toggleTheme = () => {
    setIsDark(!isDark);
    document.documentElement.classList.toggle('dark');
  };

  const savingsRate = Math.round(((balance / income) * 100));

  return (
    <div 
      className="min-h-screen bg-background transition-colors duration-300 relative overflow-hidden"
      onMouseMove={handleMouseMove}
    >
      {/* Dynamic Gradient Background */}
      <div 
        className="fixed inset-0 opacity-20 pointer-events-none transition-all duration-300"
        style={{
          background: `radial-gradient(circle 800px at ${mousePosition.x}% ${mousePosition.y}%, hsl(var(--primary)), transparent 60%)`
        }}
      />

      {/* Navigation */}
      <nav className="relative z-50 border-b border-border bg-background/80 backdrop-blur-sm sticky top-0">
        <div className="max-w-6xl mx-auto px-6 lg:px-8">
          <div className="flex justify-between items-center h-16">
            <Link href="/" className="flex items-center space-x-2 group">
              <div className="w-8 h-8 rounded-lg bg-primary flex items-center justify-center group-hover:scale-110 transition-transform">
                <svg className="w-5 h-5 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M12 8c-1.657 0-3 .895-3 2s1.343 2 3 2 3 .895 3 2-1.343 2-3 2m0-8c1.11 0 2.08.402 2.599 1M12 8V7m0 1v8m0 0v1m0-1c-1.11 0-2.08-.402-2.599-1M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                </svg>
              </div>
              <span className="text-lg font-semibold text-foreground">Prism</span>
            </Link>

            <div className="flex items-center space-x-4">
              <button
                onClick={toggleTheme}
                className="p-2 rounded-lg hover:bg-muted/50 transition-colors"
              >
                {isDark ? (
                  <svg className="w-5 h-5 text-muted-foreground" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 3v1m0 16v1m9-9h-1M4 12H3m15.364 6.364l-.707-.707M6.343 6.343l-.707-.707m12.728 0l-.707.707M6.343 17.657l-.707.707M16 12a4 4 0 11-8 0 4 4 0 018 0z" />
                  </svg>
                ) : (
                  <svg className="w-5 h-5 text-muted-foreground" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M20.354 15.354A9 9 0 018.646 3.646 9.003 9.003 0 0012 21a9.003 9.003 0 008.354-5.646z" />
                  </svg>
                )}
              </button>

              <Link href="/login" className="text-muted-foreground hover:text-foreground text-sm font-medium transition-colors">
                Log in
              </Link>
              <Link href="/register" className="bg-primary text-white px-5 py-2 rounded-lg text-sm font-medium hover:opacity-90 transition-opacity">
                Sign up
              </Link>
            </div>
          </div>
        </div>
      </nav>

      {/* Hero Section - TIGHTER SPACING */}
      <section className="relative py-12 lg:py-16">
        <div className="max-w-7xl mx-auto px-6 lg:px-8">
          <div className="grid lg:grid-cols-2 gap-12 items-center">
            <div className="relative z-10">
              <h1 className="text-5xl sm:text-6xl lg:text-7xl font-bold text-foreground mb-6 leading-tight">
                Your Money,
                <br />
                <span className="text-primary">Visualized</span>
              </h1>

              <p className="text-xl text-muted-foreground mb-8 leading-relaxed">
                Stop guessing where your money goes. See it, understand it, control it.
              </p>

              <div className="flex flex-col sm:flex-row gap-4">
                <Link
                  href="/register"
                  className="inline-flex items-center justify-center bg-primary text-white px-8 py-4 rounded-xl text-lg font-semibold hover:opacity-90 transition-all shadow-lg hover:shadow-xl hover:scale-105"
                >
                  Start Free Now
                  <svg className="w-5 h-5 ml-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M13 7l5 5m0 0l-5 5m5-5H6" />
                  </svg>
                </Link>

                <Link
                  href="#features"
                  className="inline-flex items-center justify-center border-2 border-border bg-card text-foreground px-8 py-4 rounded-xl text-lg font-semibold hover:bg-muted transition-colors"
                >
                  Learn More
                </Link>
              </div>
            </div>

            <div className="relative">
              <div className="absolute -inset-8 bg-primary/10 blur-3xl rounded-full animate-pulse" />

              <div className="relative bg-card/80 backdrop-blur-xl border border-border rounded-2xl p-8 shadow-2xl">
                <div className="bg-primary rounded-xl p-6 text-white mb-6 transform hover:scale-105 transition-transform cursor-pointer">
                  <div className="text-sm opacity-80 mb-1">Total Balance</div>
                  <div className="text-4xl font-bold mb-4 tabular-nums transition-all duration-500">
                    ${balance.toLocaleString()}
                  </div>
                  <div className="flex items-center justify-between">
                    <div>
                      <div className="text-sm opacity-80">Savings Rate</div>
                      <div className="text-xl font-bold tabular-nums">{savingsRate}%</div>
                    </div>
                    <div className="w-14 h-14 rounded-full border-4 border-white/30 flex items-center justify-center">
                      <svg className="w-7 h-7" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 7h8m0 0v8m0-8l-8 8-4-4-6 6" />
                      </svg>
                    </div>
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-4 mb-6">
                  <div className="bg-success/10 border border-success/20 rounded-xl p-4 transform hover:scale-105 transition-transform cursor-pointer">
                    <div className="text-xs text-muted-foreground mb-1">Income</div>
                    <div className="text-2xl font-bold text-success tabular-nums transition-all duration-500">
                      +${income.toLocaleString()}
                    </div>
                  </div>
                  <div className="bg-danger/10 border border-danger/20 rounded-xl p-4 transform hover:scale-105 transition-transform cursor-pointer">
                    <div className="text-xs text-muted-foreground mb-1">Expenses</div>
                    <div className="text-2xl font-bold text-danger tabular-nums transition-all duration-500">
                      -${expenses.toLocaleString()}
                    </div>
                  </div>
                </div>

                <div className="space-y-2">
                  {[
                    { emoji: '🍕', name: 'Food & Dining', percent: 32, amount: 680, color: 'bg-primary' },
                    { emoji: '🏠', name: 'Rent & Utilities', percent: 48, amount: 1020, color: 'bg-accent' },
                    { emoji: '🎬', name: 'Entertainment', percent: 20, amount: 400, color: 'bg-warning' }
                  ].map((item, idx) => (
                    <div key={idx} className="group relative overflow-hidden rounded-lg bg-muted/30 p-3 hover:bg-muted/50 transition-all cursor-pointer">
                      <div className="flex items-center justify-between relative z-10">
                        <div className="flex items-center space-x-3">
                          <span className="text-2xl">{item.emoji}</span>
                          <div>
                            <div className="text-sm font-medium text-foreground">{item.name}</div>
                            <div className="text-xs text-muted-foreground">{item.percent}% of total</div>
                          </div>
                        </div>
                        <div className="text-sm font-semibold text-foreground">${item.amount}</div>
                      </div>
                      <div 
                        className={`absolute bottom-0 left-0 h-1 ${item.color} transition-all duration-300 group-hover:h-full group-hover:opacity-10`}
                        style={{ width: `${item.percent}%` }}
                      />
                    </div>
                  ))}
                </div>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* Features - Bento Grid */}
      <section id="features" className="relative py-20 bg-muted/30">
        <div className="max-w-7xl mx-auto px-6 lg:px-8">
          <div className="text-center mb-12">
            <h2 className="text-4xl font-bold text-foreground mb-4">
              Everything you need
            </h2>
            <p className="text-lg text-muted-foreground">
              Hover to explore
            </p>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div
              onMouseEnter={() => setHoveredFeature(0)}
              onMouseLeave={() => setHoveredFeature(null)}
              className="md:col-span-2 md:row-span-2 relative overflow-hidden bg-primary/5 border-2 border-primary/20 rounded-3xl p-8 group cursor-pointer transition-all duration-300 hover:shadow-2xl hover:border-primary/40"
            >
              <div className="absolute inset-0 bg-primary/0 group-hover:bg-primary/5 transition-colors duration-500" />
              <div className="relative z-10">
                <div className="inline-flex items-center justify-center w-16 h-16 rounded-2xl bg-primary/20 mb-6 group-hover:scale-110 transition-transform">
                  <svg className="w-8 h-8 text-primary" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 10V3L4 14h7v7l9-11h-7z" />
                  </svg>
                </div>
                <h3 className="text-3xl font-bold text-foreground mb-4">Lightning fast</h3>
                <p className="text-lg text-muted-foreground max-w-md">
                  Add expenses in seconds. No forms, no complexity.
                </p>
                
                {hoveredFeature === 0 && (
                  <div className="mt-6 p-4 bg-background/50 rounded-xl border border-border animate-slide-up">
                    <p className="text-sm text-muted-foreground italic">
                      "$5.50 coffee" → Auto-categorized instantly
                    </p>
                  </div>
                )}
              </div>
            </div>

            <div
              onMouseEnter={() => setHoveredFeature(1)}
              onMouseLeave={() => setHoveredFeature(null)}
              className="relative overflow-hidden bg-accent/5 border-2 border-accent/20 rounded-3xl p-6 group cursor-pointer transition-all duration-300 hover:shadow-xl hover:border-accent/40"
            >
              <div className="relative z-10">
                <div className="w-12 h-12 rounded-xl bg-accent/20 mb-4 flex items-center justify-center group-hover:scale-110 transition-transform">
                  <svg className="w-6 h-6 text-accent" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9.663 17h4.673M12 3v1m6.364 1.636l-.707.707M21 12h-1M4 12H3m3.343-5.657l-.707-.707m2.828 9.9a5 5 0 117.072 0l-.548.547A3.374 3.374 0 0014 18.469V19a2 2 0 11-4 0v-.531c0-.895-.356-1.754-.988-2.386l-.548-.547z" />
                  </svg>
                </div>
                <h3 className="text-lg font-bold text-foreground mb-2">Smart sorting</h3>
                <p className="text-sm text-muted-foreground">
                  AI categorizes automatically
                </p>
              </div>
            </div>

            <div
              onMouseEnter={() => setHoveredFeature(2)}
              onMouseLeave={() => setHoveredFeature(null)}
              className="relative overflow-hidden bg-success/5 border-2 border-success/20 rounded-3xl p-6 group cursor-pointer transition-all duration-300 hover:shadow-xl hover:border-success/40"
            >
              <div className="relative z-10">
                <div className="w-12 h-12 rounded-xl bg-success/20 mb-4 flex items-center justify-center group-hover:scale-110 transition-transform">
                  <svg className="w-6 h-6 text-success" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z" />
                  </svg>
                </div>
                <h3 className="text-lg font-bold text-foreground mb-2">Clear insights</h3>
                <p className="text-sm text-muted-foreground">
                  Charts that make sense
                </p>
              </div>
            </div>

            <div
              onMouseEnter={() => setHoveredFeature(3)}
              onMouseLeave={() => setHoveredFeature(null)}
              className="relative overflow-hidden bg-warning/5 border-2 border-warning/20 rounded-3xl p-6 group cursor-pointer transition-all duration-300 hover:shadow-xl hover:border-warning/40"
            >
              <div className="relative z-10">
                <div className="w-12 h-12 rounded-xl bg-warning/20 mb-4 flex items-center justify-center group-hover:scale-110 transition-transform">
                  <svg className="w-6 h-6 text-warning" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 18h.01M8 21h8a2 2 0 002-2V5a2 2 0 00-2-2H8a2 2 0 00-2 2v14a2 2 0 002 2z" />
                  </svg>
                </div>
                <h3 className="text-lg font-bold text-foreground mb-2">Mobile ready</h3>
                <p className="text-sm text-muted-foreground">
                  Works everywhere
                </p>
              </div>
            </div>

            <div
              onMouseEnter={() => setHoveredFeature(4)}
              onMouseLeave={() => setHoveredFeature(null)}
              className="md:col-span-2 relative overflow-hidden bg-secondary/5 border-2 border-secondary/20 rounded-3xl p-8 group cursor-pointer transition-all duration-300 hover:shadow-xl hover:border-secondary/40"
            >
              <div className="relative z-10">
                <div className="w-14 h-14 rounded-xl bg-secondary/20 mb-4 flex items-center justify-center group-hover:scale-110 transition-transform">
                  <svg className="w-7 h-7 text-secondary" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z" />
                  </svg>
                </div>
                <h3 className="text-2xl font-bold text-foreground mb-3">Your data stays private</h3>
                <p className="text-muted-foreground">
                  No tracking. No data selling. Your finances are yours alone.
                </p>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* How It Works */}
      <section className="py-20 relative">
        <div className="max-w-4xl mx-auto px-6 lg:px-8">
          <div className="text-center mb-12">
            <h2 className="text-4xl font-bold text-foreground mb-4">
              Get started in 3 steps
            </h2>
          </div>

          <div className="space-y-8 relative">
            <div className="absolute left-8 top-8 bottom-8 w-0.5 bg-primary/20 hidden md:block" />

            {[
              { step: '01', title: 'Create account', desc: 'Sign up in 30 seconds' },
              { step: '02', title: 'Add expenses', desc: 'Log as you spend' },
              { step: '03', title: 'See insights', desc: 'Understand your money' }
            ].map((item, idx) => (
              <div key={idx} className="relative flex items-start md:pl-20">
                <div className="absolute left-0 w-16 h-16 rounded-full bg-primary flex items-center justify-center text-white font-bold text-lg shadow-lg">
                  {item.step}
                </div>

                <div className="flex-1 bg-card border border-border rounded-xl p-6 hover:shadow-lg transition-all hover:scale-105 cursor-pointer">
                  <h3 className="text-xl font-bold text-foreground mb-2">{item.title}</h3>
                  <p className="text-muted-foreground">{item.desc}</p>
                </div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Footer - Copyright Only */}
      <footer className="border-t border-border py-6 bg-card mt-20">
        <div className="max-w-6xl mx-auto px-6 lg:px-8 text-center text-sm text-muted-foreground">
          © 2025 Prism • Built by Krishna Madani
        </div>
      </footer>
    </div>
  );
}