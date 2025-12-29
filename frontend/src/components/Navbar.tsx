'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { toast } from 'react-hot-toast';

interface NavbarProps {
  currentPage: 'dashboard' | 'transactions' | 'categories' | 'analytics' | 'gamification' | 'profile' | 'forecast';
}

export default function Navbar({ currentPage }: NavbarProps) {
  const router = useRouter();
  const [theme, setTheme] = useState<'light' | 'dark'>('dark');

  useEffect(() => {
    const savedTheme = localStorage.getItem('theme') as 'light' | 'dark' | null;
    const systemTheme = window.matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light';
    const initialTheme = savedTheme || systemTheme;

    setTheme(initialTheme);
    document.documentElement.classList.toggle('dark', initialTheme === 'dark');
  }, []);

  const toggleTheme = () => {
    const newTheme = theme === 'dark' ? 'light' : 'dark';
    setTheme(newTheme);
    localStorage.setItem('theme', newTheme);
    document.documentElement.classList.toggle('dark', newTheme === 'dark');
  };

  const handleLogout = async () => {
    try {
      localStorage.removeItem('access_token');
      localStorage.removeItem('refresh_token');
      toast.success('Logged out successfully');
      router.push('/');
    } catch (error) {
      console.error('Logout error:', error);
      toast.error('Failed to logout');
    }
  };

  return (
    <nav className="border-b border-border bg-card sticky top-0 z-50 backdrop-blur">
      <div className="max-w-7xl mx-auto px-6 lg:px-8">
        <div className="flex items-center justify-between h-16">
          <Link href="/" className="flex items-center space-x-2 group">
            <div className="w-8 h-8 rounded-lg bg-primary flex items-center justify-center group-hover:scale-110 transition-transform">
              <svg className="w-5 h-5 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M12 8c-1.657 0-3 .895-3 2s1.343 2 3 2 3 .895 3 2-1.343 2-3 2m0-8c1.11 0 2.08.402 2.599 1M12 8V7m0 1v8m0 0v1m0-1c-1.11 0-2.08-.402-2.599-1M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
              </svg>
            </div>
            <span className="text-lg font-bold text-foreground">Budgetly</span>
          </Link>

          <div className="flex items-center space-x-6">
            <Link
              href="/dashboard"
              className={`text-sm font-medium ${currentPage === 'dashboard'
                  ? 'text-primary border-b-2 border-primary pb-0.5'
                  : 'text-muted-foreground hover:text-foreground transition-colors'
                }`}
            >
              Dashboard
            </Link>
            <Link
              href="/transactions"
              className={`text-sm font-medium ${currentPage === 'transactions'
                  ? 'text-primary border-b-2 border-primary pb-0.5'
                  : 'text-muted-foreground hover:text-foreground transition-colors'
                }`}
            >
              Transactions
            </Link>
            <Link
              href="/categories"
              className={`text-sm font-medium ${currentPage === 'categories'
                  ? 'text-primary border-b-2 border-primary pb-0.5'
                  : 'text-muted-foreground hover:text-foreground transition-colors'
                }`}
            >
              Categories
            </Link>
            <Link
              href="/analytics"
              className={`text-sm font-medium ${currentPage === 'analytics'
                  ? 'text-primary border-b-2 border-primary pb-0.5'
                  : 'text-muted-foreground hover:text-foreground transition-colors'
                }`}
            >
              Analytics
            </Link>
            <Link
              href="/gamification"
              className={`text-sm font-medium ${currentPage === 'gamification'
                  ? 'text-primary border-b-2 border-primary pb-0.5'
                  : 'text-muted-foreground hover:text-foreground transition-colors'
                }`}
            >
              Progress
            </Link>
            <Link
              href="/forecast"
              className={`text-sm font-medium ${currentPage === 'forecast'
                  ? 'text-primary border-b-2 border-primary pb-0.5'
                  : 'text-muted-foreground hover:text-foreground transition-colors'
                }`}
            >
              Forecast
            </Link>
            <Link
              href="/profile"
              className={`text-sm font-medium ${currentPage === 'profile'
                  ? 'text-primary border-b-2 border-primary pb-0.5'
                  : 'text-muted-foreground hover:text-foreground transition-colors'
                }`}
            >
              Profile
            </Link>

            <button
              onClick={toggleTheme}
              className="p-2 rounded-lg hover:bg-muted/50 transition-colors"
            >
              {theme === 'dark' ? (
                <svg className="w-5 h-5 text-muted-foreground" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 3v1m0 16v1m9-9h-1M4 12H3m15.364 6.364l-.707-.707M6.343 6.343l-.707-.707m12.728 0l-.707.707M6.343 17.657l-.707.707M16 12a4 4 0 11-8 0 4 4 0 018 0z" />
                </svg>
              ) : (
                <svg className="w-5 h-5 text-muted-foreground" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M20.354 15.354A9 9 0 018.646 3.646 9.003 9.003 0 0012 21a9.003 9.003 0 008.354-5.646z" />
                </svg>
              )}
            </button>

            <button
              onClick={handleLogout}
              className="p-2 rounded-lg text-muted-foreground hover:text-red-500 transition-colors"
              aria-label="Logout"
            >
              <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 16l4-4m0 0l-4-4m4 4H7m6 4v1a3 3 0 01-3 3H6a3 3 0 01-3-3V7a3 3 0 013-3h4a3 3 0 013 3v1" />
              </svg>
            </button>
          </div>
        </div>
      </div>
    </nav>
  );
}