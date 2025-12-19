'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { useDispatch } from 'react-redux';
import Link from 'next/link';
import api from '@/lib/api';
import { clearAuth } from '@/lib/authSlice';

interface Transaction {
  id: string;
  amount: string;
  currency: string;
  note: string;
  spent_at: string;
  category: string | null;
  category_name?: string;
  category_type?: 'INCOME' | 'EXPENSE';
  created_at: string;
  updated_at: string;
}

interface Category {
  id: string;
  name: string;
  type: 'INCOME' | 'EXPENSE';
}

interface Summary {
  income: number;
  expense: number;
  balance: number;
}

interface TransactionResponse {
  count: number;
  results: Transaction[];
}

export default function DashboardPage() {
  const router = useRouter();
  const dispatch = useDispatch();
  const [summary, setSummary] = useState<Summary | null>(null);
  const [recentTransactions, setRecentTransactions] = useState<Transaction[]>([]);
  const [categories, setCategories] = useState<Category[]>([]);
  const [loading, setLoading] = useState(true);
  const [theme, setTheme] = useState<'light' | 'dark'>('dark');

  useEffect(() => {
    const token = localStorage.getItem('access_token');
    if (!token) {
      router.push('/login');
      return;
    }

    // Load theme
    const savedTheme = localStorage.getItem('theme') as 'light' | 'dark' | null;
    const systemTheme = window.matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light';
    const initialTheme = savedTheme || systemTheme;
    
    setTheme(initialTheme);
    document.documentElement.classList.toggle('dark', initialTheme === 'dark');

    fetchDashboardData();
  }, [router]);

  const toggleTheme = () => {
    const newTheme = theme === 'dark' ? 'light' : 'dark';
    setTheme(newTheme);
    localStorage.setItem('theme', newTheme);
    document.documentElement.classList.toggle('dark', newTheme === 'dark');
  };

  const fetchDashboardData = async () => {
    try {
      setLoading(true);
      
      const [summaryRes, transactionsRes, categoriesRes] = await Promise.all([
        api.get('/transactions/summary'),
        api.get('/transactions'),
        api.get('/categories')
      ]);

      setSummary(summaryRes.data);
      
      const transactionData = transactionsRes.data as TransactionResponse;
      setRecentTransactions((transactionData.results || []).slice(0, 10));
      
      setCategories(categoriesRes.data || []);
    } catch (error: any) {
      console.error('Failed to fetch dashboard data:', error);
      
      if (error.response?.status === 401) {
        localStorage.removeItem('access_token');
        localStorage.removeItem('refresh_token');
        router.push('/login');
      }
    } finally {
      setLoading(false);
    }
  };

  const handleLogout = () => {
    localStorage.removeItem('access_token');
    localStorage.removeItem('refresh_token');
    dispatch(clearAuth());
    router.push('/');
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <div className="text-center">
          <div className="w-16 h-16 border-4 border-primary border-t-transparent rounded-full animate-spin mx-auto mb-4" />
          <p className="text-muted-foreground">Loading dashboard...</p>
        </div>
      </div>
    );
  }

  const balance = summary?.balance || 0;
  const income = summary?.income || 0;
  const expenses = summary?.expense || 0;
  const savingsRate = income > 0 ? Math.round(((income - expenses) / income) * 100) : 0;

  // Calculate spending breakdown by category
  const spendingBreakdown = categories
    .filter(cat => cat.type === 'EXPENSE')
    .map(cat => {
      const categoryTransactions = recentTransactions.filter(
        t => t.category === cat.id && t.category_type === 'EXPENSE'
      );
      const categoryTotal = categoryTransactions.reduce(
        (sum, t) => sum + parseFloat(t.amount), 
        0
      );
      const percentage = expenses > 0 ? (categoryTotal / expenses) * 100 : 0;
      
      return {
        category: cat.name,
        amount: categoryTotal,
        percentage: percentage
      };
    })
    .filter(item => item.amount > 0)
    .sort((a, b) => b.amount - a.amount)
    .slice(0, 5);

  return (
    <div className="min-h-screen bg-background">
      {/* Navigation Bar */}
      <nav className="border-b border-border bg-card sticky top-0 z-50 backdrop-blur">
        <div className="max-w-7xl mx-auto px-6 lg:px-8">
          <div className="flex items-center justify-between h-16">
            {/* Logo */}
            <Link href="/" className="flex items-center space-x-2 group">
              <div className="w-8 h-8 rounded-lg bg-primary flex items-center justify-center group-hover:scale-110 transition-transform">
                <svg className="w-5 h-5 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M12 8c-1.657 0-3 .895-3 2s1.343 2 3 2 3 .895 3 2-1.343 2-3 2m0-8c1.11 0 2.08.402 2.599 1M12 8V7m0 1v8m0 0v1m0-1c-1.11 0-2.08-.402-2.599-1M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                </svg>
              </div>
              <span className="text-lg font-bold text-foreground">Budgetly</span>
            </Link>

            {/* Nav Links */}
            <div className="flex items-center space-x-6">
              <Link 
                href="/dashboard" 
                className="text-sm font-medium text-primary border-b-2 border-primary pb-0.5"
              >
                Dashboard
              </Link>
              <Link 
                href="/transactions" 
                className="text-sm font-medium text-muted-foreground hover:text-foreground transition-colors"
              >
                Transactions
              </Link>
              <Link 
                href="/categories" 
                className="text-sm font-medium text-muted-foreground hover:text-foreground transition-colors"
              >
                Categories
              </Link>

              {/* Theme Toggle */}
              <button
                onClick={toggleTheme}
                className="p-2 rounded-lg border border-border hover:bg-accent transition-colors"
                aria-label="Toggle theme"
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
              
              {/* Logout */}
              <button
                onClick={handleLogout}
                className="text-sm font-medium text-muted-foreground hover:text-red-500 transition-colors flex items-center space-x-1"
              >
                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 16l4-4m0 0l-4-4m4 4H7m6 4v1a3 3 0 01-3 3H6a3 3 0 01-3-3V7a3 3 0 013-3h4a3 3 0 013 3v1" />
                </svg>
                <span>Logout</span>
              </button>
            </div>
          </div>
        </div>
      </nav>

      {/* Main Content */}
      <div className="max-w-7xl mx-auto px-6 lg:px-8 py-8">
        {/* Header */}
        <div className="flex flex-col sm:flex-row sm:items-center justify-between mb-8 gap-4">
          <div>
            <h1 className="text-3xl font-bold text-foreground mb-1">Dashboard</h1>
            <p className="text-muted-foreground">Your financial overview</p>
          </div>

          {/* Add Transaction Button */}
          <Link
            href="/transactions"
            className="px-6 py-3 bg-primary text-white font-semibold rounded-xl hover:opacity-90 transition-opacity flex items-center space-x-2 shadow-lg"
          >
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 6v6m0 0v6m0-6h6m-6 0H6" />
            </svg>
            <span>Add Transaction</span>
          </Link>
        </div>

        {/* Summary Cards */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-8">
          {/* Balance Card */}
          <div className="bg-gradient-to-br from-primary to-primary/80 rounded-xl p-6 text-white shadow-lg">
            <div className="flex items-center justify-between mb-4">
              <div className="w-12 h-12 rounded-lg bg-white/20 flex items-center justify-center">
                <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8c-1.657 0-3 .895-3 2s1.343 2 3 2 3 .895 3 2-1.343 2-3 2m0-8c1.11 0 2.08.402 2.599 1M12 8V7m0 1v8m0 0v1m0-1c-1.11 0-2.08-.402-2.599-1M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                </svg>
              </div>
              <div className="text-sm font-medium opacity-90">Savings: {savingsRate}%</div>
            </div>
            <div className="text-3xl font-bold mb-1">${balance.toFixed(2)}</div>
            <div className="text-sm opacity-90">Current Balance</div>
          </div>

          {/* Income Card */}
          <div className="bg-card border border-border rounded-xl p-6 hover:shadow-lg transition-shadow">
            <div className="flex items-center space-x-3">
              <div className="w-12 h-12 rounded-lg bg-green-500/10 flex items-center justify-center">
                <svg className="w-6 h-6 text-green-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 7h8m0 0v8m0-8l-8 8-4-4-6 6" />
                </svg>
              </div>
              <div>
                <div className="text-2xl font-bold text-foreground">${income.toFixed(2)}</div>
                <div className="text-sm text-muted-foreground">Total Income</div>
              </div>
            </div>
          </div>

          {/* Expenses Card */}
          <div className="bg-card border border-border rounded-xl p-6 hover:shadow-lg transition-shadow">
            <div className="flex items-center space-x-3">
              <div className="w-12 h-12 rounded-lg bg-red-500/10 flex items-center justify-center">
                <svg className="w-6 h-6 text-red-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 17h8m0 0V9m0 8l-8-8-4 4-6-6" />
                </svg>
              </div>
              <div>
                <div className="text-2xl font-bold text-foreground">${expenses.toFixed(2)}</div>
                <div className="text-sm text-muted-foreground">Total Expenses</div>
              </div>
            </div>
          </div>
        </div>

        {/* Recent Transactions & Spending Breakdown */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
          {/* Recent Transactions */}
          <div className="bg-card border border-border rounded-xl p-6">
            <div className="flex items-center justify-between mb-6">
              <h2 className="text-xl font-bold text-foreground">Recent Transactions</h2>
              <Link 
                href="/transactions"
                className="text-sm text-primary hover:underline font-medium"
              >
                View all
              </Link>
            </div>

            {recentTransactions.length === 0 ? (
              <div className="text-center py-12">
                <svg className="w-16 h-16 mx-auto text-muted-foreground/50 mb-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                </svg>
                <p className="text-muted-foreground">No transactions yet</p>
                <p className="text-sm text-muted-foreground mt-1">Add your first transaction to get started</p>
                <Link
                  href="/transactions"
                  className="inline-block mt-4 px-4 py-2 bg-primary text-white rounded-lg hover:opacity-90 transition-opacity text-sm font-medium"
                >
                  Add Transaction
                </Link>
              </div>
            ) : (
              <div className="space-y-3">
                {recentTransactions.map((transaction) => (
                  <div 
                    key={transaction.id} 
                    className="flex items-center justify-between p-4 bg-background border border-border rounded-lg hover:shadow-md transition-shadow"
                  >
                    <div className="flex items-center space-x-3">
                      <div className={`w-10 h-10 rounded-lg flex items-center justify-center ${
                        transaction.category_type === 'INCOME' 
                          ? 'bg-green-500/10' 
                          : 'bg-red-500/10'
                      }`}>
                        <svg 
                          className={`w-5 h-5 ${
                            transaction.category_type === 'INCOME' 
                              ? 'text-green-500' 
                              : 'text-red-500'
                          }`} 
                          fill="none" 
                          stroke="currentColor" 
                          viewBox="0 0 24 24"
                        >
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d={
                            transaction.category_type === 'INCOME'
                              ? "M13 7h8m0 0v8m0-8l-8 8-4-4-6 6"
                              : "M13 17h8m0 0V9m0 8l-8-8-4 4-6-6"
                          } />
                        </svg>
                      </div>
                      <div>
                        <div className="font-medium text-foreground">
                          {transaction.note || transaction.category_name || 'No note'}
                        </div>
                        <div className="text-sm text-muted-foreground">
                          {transaction.category_name || 'Uncategorized'} • {new Date(transaction.spent_at).toLocaleDateString()}
                        </div>
                      </div>
                    </div>
                    <div className={`font-bold ${
                      transaction.category_type === 'INCOME' 
                        ? 'text-green-500' 
                        : 'text-red-500'
                    }`}>
                      {transaction.category_type === 'INCOME' ? '+' : '-'}
                      ${parseFloat(transaction.amount).toFixed(2)}
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* Spending Breakdown */}
          <div className="bg-card border border-border rounded-xl p-6">
            <h2 className="text-xl font-bold text-foreground mb-6">Spending Breakdown</h2>

            {spendingBreakdown.length === 0 ? (
              <div className="text-center py-12">
                <svg className="w-16 h-16 mx-auto text-muted-foreground/50 mb-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z" />
                </svg>
                <p className="text-muted-foreground">No spending data yet</p>
                <p className="text-sm text-muted-foreground mt-1">Start adding expenses to see your breakdown</p>
              </div>
            ) : (
              <div className="space-y-4">
                {spendingBreakdown.map((item, index) => (
                  <div key={index}>
                    <div className="flex items-center justify-between mb-2">
                      <span className="text-sm font-medium text-foreground">
                        {item.category}
                      </span>
                      <span className="text-sm text-muted-foreground">
                        ${item.amount.toFixed(2)} ({item.percentage.toFixed(0)}%)
                      </span>
                    </div>
                    <div className="w-full h-2 bg-border rounded-full overflow-hidden">
                      <div 
                        className="h-full bg-primary transition-all duration-300"
                        style={{ width: `${item.percentage}%` }}
                      />
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>

        {/* Quick Stats */}
        <div className="mt-8 grid grid-cols-1 sm:grid-cols-3 gap-6">
          <div className="bg-card border border-border rounded-xl p-6 hover:shadow-lg transition-shadow">
            <div className="flex items-center space-x-3">
              <div className="w-12 h-12 rounded-lg bg-primary/10 flex items-center justify-center">
                <svg className="w-6 h-6 text-primary" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                </svg>
              </div>
              <div>
                <div className="text-2xl font-bold text-foreground">{recentTransactions.length}</div>
                <div className="text-sm text-muted-foreground">Recent Transactions</div>
              </div>
            </div>
          </div>

          <div className="bg-card border border-border rounded-xl p-6 hover:shadow-lg transition-shadow">
            <div className="flex items-center space-x-3">
              <div className="w-12 h-12 rounded-lg bg-primary/10 flex items-center justify-center">
                <svg className="w-6 h-6 text-primary" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M7 7h.01M7 3h5c.512 0 1.024.195 1.414.586l7 7a2 2 0 010 2.828l-7 7a2 2 0 01-2.828 0l-7-7A1.994 1.994 0 013 12V7a4 4 0 014-4z" />
                </svg>
              </div>
              <div>
                <div className="text-2xl font-bold text-foreground">{categories.length}</div>
                <div className="text-sm text-muted-foreground">Categories</div>
              </div>
            </div>
          </div>

          <div className="bg-card border border-border rounded-xl p-6 hover:shadow-lg transition-shadow">
            <div className="flex items-center space-x-3">
              <div className="w-12 h-12 rounded-lg bg-green-500/10 flex items-center justify-center">
                <svg className="w-6 h-6 text-green-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v13m0-13V6a2 2 0 112 2h-2zm0 0V5.5A2.5 2.5 0 109.5 8H12zm-7 4h14M5 12a2 2 0 110-4h14a2 2 0 110 4M5 12v7a2 2 0 002 2h10a2 2 0 002-2v-7" />
                </svg>
              </div>
              <div>
                <div className="text-2xl font-bold text-foreground">{savingsRate}%</div>
                <div className="text-sm text-muted-foreground">Savings Rate</div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}