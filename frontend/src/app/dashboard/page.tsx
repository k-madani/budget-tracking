'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import api from '@/lib/api';
import { toast } from 'react-hot-toast';
import Navbar from '@/components/Navbar';
import TransactionModal from '@/components/TransactionModal';

interface Transaction {
  id: string;
  amount: string;
  currency: string;
  note: string;
  spent_at: string;
  category: string | null;
  category_name?: string;
  category_type?: 'INCOME' | 'EXPENSE';
}

interface Category {
  id: string;
  name: string;
  type: 'INCOME' | 'EXPENSE';
  budget_limit?: number | null;
  current_spending?: number;
}

interface LevelData {
  current: number;
  total_points: number;
  points_to_next_level: number;
  progress_percentage: number;
}

interface Achievement {
  id: number;
  name: string;
  description: string;
  icon: string;
  points: number;
  is_unlocked: boolean;
}

interface GamificationStats {
  total_points: number;
  level: LevelData;
  achievements: {
    unlocked: Achievement[];
    unlocked_count: number;
    total_count: number;
  };
}

export default function DashboardPage() {
  const router = useRouter();
  const [recentTransactions, setRecentTransactions] = useState<Transaction[]>([]);
  const [allTransactions, setAllTransactions] = useState<Transaction[]>([]);
  const [categories, setCategories] = useState<Category[]>([]);
  const [loading, setLoading] = useState(true);
  const [isQuickAddOpen, setIsQuickAddOpen] = useState(false);
  const [gamificationStats, setGamificationStats] = useState<GamificationStats | null>(null);

  const [balance, setBalance] = useState(0);
  const [income, setIncome] = useState(0);
  const [expenses, setExpenses] = useState(0);

  useEffect(() => {
    const token = localStorage.getItem('access_token');
    if (!token) {
      router.push('/login');
      return;
    }

    fetchDashboardData();
  }, [router]);

  const fetchDashboardData = async () => {
    try {
      setLoading(true);

      const [summaryRes, transactionsRes, categoriesRes, gamificationRes] = await Promise.all([
        api.get('/transactions/summary'),
        api.get('/transactions'),
        api.get('/categories'),
        api.get('/stats').catch(() => null),
      ]);

      if (summaryRes.data) {
        setBalance(summaryRes.data.balance || 0);
        setIncome(summaryRes.data.income || 0);
        setExpenses(summaryRes.data.expense || 0);
      }

      const allTxns = transactionsRes.data.results || transactionsRes.data || [];
      setAllTransactions(allTxns);
      setRecentTransactions(allTxns.slice(0, 4));

      setCategories(categoriesRes.data || []);

      if (gamificationRes?.data) {
        setGamificationStats(gamificationRes.data);
      }
    } catch (error: any) {
      console.error('Error fetching dashboard data:', error);
      toast.error('Failed to load dashboard data');
      
      if (error.response?.status === 401) {
        localStorage.removeItem('access_token');
        localStorage.removeItem('refresh_token');
        router.push('/login');
      }
    } finally {
      setLoading(false);
    }
  }; 

  const getWeeklySpending = () => {
    const now = new Date();
    const sevenDaysAgo = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);
    const fourteenDaysAgo = new Date(now.getTime() - 14 * 24 * 60 * 60 * 1000);

    const thisWeek = allTransactions
      .filter(t => t.category_type === 'EXPENSE' && new Date(t.spent_at) >= sevenDaysAgo)
      .reduce((sum, t) => sum + parseFloat(t.amount), 0);

    const lastWeek = allTransactions
      .filter(t => t.category_type === 'EXPENSE' && new Date(t.spent_at) >= fourteenDaysAgo && new Date(t.spent_at) < sevenDaysAgo)
      .reduce((sum, t) => sum + parseFloat(t.amount), 0);

    const change = lastWeek > 0 ? ((thisWeek - lastWeek) / lastWeek) * 100 : 0;

    const dailyData = [];
    for (let i = 6; i >= 0; i--) {
      const date = new Date(now);
      date.setDate(date.getDate() - i);
      const dateStr = date.toISOString().split('T')[0];
      
      const daySpending = allTransactions
        .filter(t => t.category_type === 'EXPENSE' && t.spent_at.split('T')[0] === dateStr)
        .reduce((sum, t) => sum + parseFloat(t.amount), 0);
      
      dailyData.push(daySpending);
    }

    return { thisWeek, lastWeek, change, dailyData };
  };

  const getBudgetHealth = () => {
    return categories
      .filter(cat => cat.type === 'EXPENSE' && cat.budget_limit)
      .map(cat => {
        const budgetLimit = Number(cat.budget_limit) || 0;
        const currentSpending = Number(cat.current_spending) || 0;
        const percentage = budgetLimit > 0 ? (currentSpending / budgetLimit) * 100 : 0;
        
        return {
          name: cat.name,
          spent: currentSpending,
          budget: budgetLimit,
          percentage,
          status: percentage >= 100 ? 'over' : percentage >= 80 ? 'warning' : 'good'
        };
      })
      .sort((a, b) => b.percentage - a.percentage)
      .slice(0, 3);
  };

  const getCategoryIcon = (categoryName: string) => {
    const name = categoryName.toLowerCase();
    if (name.includes('food') || name.includes('dining') || name.includes('restaurant')) return '☕';
    if (name.includes('shop') || name.includes('shopping')) return '🛍️';
    if (name.includes('transport') || name.includes('uber') || name.includes('ride')) return '🚗';
    if (name.includes('grocery') || name.includes('groceries')) return '🛒';
    if (name.includes('entertainment')) return '🎬';
    if (name.includes('health')) return '💊';
    return '💳';
  };

  const weeklySpending = getWeeklySpending();
  const budgetHealth = getBudgetHealth();

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

  return (
    <div className="min-h-screen bg-background">
      <Navbar currentPage="dashboard" />

      <div className="max-w-7xl mx-auto px-6 lg:px-8 py-8">
        {/* Header */}
        <div className="flex items-center justify-between mb-8">
          <div>
            <h1 className="text-3xl font-bold text-foreground">Dashboard</h1>
            <p className="text-muted-foreground text-sm">Your financial overview</p>
          </div>
          <button
            onClick={() => setIsQuickAddOpen(true)}
            className="bg-primary text-white px-6 py-3 rounded-xl font-semibold hover:opacity-90 transition-all shadow-lg hover:shadow-xl hover:scale-105"
          >
            + Add Transaction
          </button>
        </div>

        {/* Hero Stats Cards */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-8">
          {/* Current Balance */}
          <div className="group relative overflow-hidden bg-card/80 backdrop-blur-sm rounded-2xl p-6 border-2 border-border hover:border-primary/40 transition-all duration-300 hover:shadow-xl hover:-translate-y-1 cursor-pointer">
            <div className="absolute inset-0 bg-gradient-to-br from-primary/5 to-transparent opacity-0 group-hover:opacity-100 transition-opacity" />
            <div className="relative">
              <div className="flex items-center justify-between mb-3">
                <p className="text-muted-foreground text-sm font-medium">Current Balance</p>
                <div className="w-10 h-10 bg-primary/10 rounded-xl flex items-center justify-center group-hover:scale-110 transition-transform">
                  <svg className="w-5 h-5 text-primary" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 10h18M7 15h1m4 0h1m-7 4h12a3 3 0 003-3V8a3 3 0 00-3-3H6a3 3 0 00-3 3v8a3 3 0 003 3z" />
                  </svg>
                </div>
              </div>
              <p className="text-4xl font-bold text-foreground">${balance.toFixed(2)}</p>
            </div>
          </div>

          {/* Total Income */}
          <div className="group relative overflow-hidden bg-card/80 backdrop-blur-sm rounded-2xl p-6 border-2 border-border hover:border-success/40 transition-all duration-300 hover:shadow-xl hover:-translate-y-1 cursor-pointer">
            <div className="absolute inset-0 bg-gradient-to-br from-success/5 to-transparent opacity-0 group-hover:opacity-100 transition-opacity" />
            <div className="relative">
              <div className="flex items-center justify-between mb-3">
                <p className="text-muted-foreground text-sm font-medium">Total Income</p>
                <div className="w-10 h-10 bg-success/10 rounded-xl flex items-center justify-center group-hover:scale-110 transition-transform">
                  <svg className="w-5 h-5 text-success" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 7h8m0 0v8m0-8l-8 8-4-4-6 6" />
                  </svg>
                </div>
              </div>
              <p className="text-4xl font-bold text-success">${income.toFixed(2)}</p>
            </div>
          </div>

          {/* Total Expenses */}
          <div className="group relative overflow-hidden bg-card/80 backdrop-blur-sm rounded-2xl p-6 border-2 border-border hover:border-danger/40 transition-all duration-300 hover:shadow-xl hover:-translate-y-1 cursor-pointer">
            <div className="absolute inset-0 bg-gradient-to-br from-danger/5 to-transparent opacity-0 group-hover:opacity-100 transition-opacity" />
            <div className="relative">
              <div className="flex items-center justify-between mb-3">
                <p className="text-muted-foreground text-sm font-medium">Total Expenses</p>
                <div className="w-10 h-10 bg-danger/10 rounded-xl flex items-center justify-center group-hover:scale-110 transition-transform">
                  <svg className="w-5 h-5 text-danger" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 17h8m0 0V9m0 8l-8-8-4 4-6-6" />
                  </svg>
                </div>
              </div>
              <p className="text-4xl font-bold text-danger">${expenses.toFixed(2)}</p>
            </div>
          </div>
        </div>

        {/* Progress Section */}
        {gamificationStats && (
          <div className="mb-8">
            <Link 
              href="/gamification"
              className="group block relative overflow-hidden bg-gradient-to-br from-accent/10 via-primary/5 to-warning/5 border-2 border-primary/20 rounded-2xl p-6 hover:border-primary/40 hover:shadow-xl transition-all duration-300 hover:-translate-y-1"
            >
              {/* Animated background */}
              <div className="absolute inset-0 bg-gradient-to-br from-primary/5 to-transparent opacity-0 group-hover:opacity-100 transition-opacity" />
              
              <div className="relative">
                <div className="flex items-center justify-between mb-4">
                  <div className="flex items-center gap-4">
                    <div className="w-16 h-16 bg-primary/20 rounded-xl flex items-center justify-center group-hover:scale-110 transition-transform">
                      <span className="text-3xl">🎯</span>
                    </div>
                    <div>
                      <h3 className="text-xl font-bold text-foreground mb-1">Your Progress & Achievements</h3>
                      <p className="text-sm text-muted-foreground">
                        {gamificationStats.total_points} points earned • {gamificationStats.achievements?.unlocked_count || 0}/{gamificationStats.achievements?.total_count || 0} unlocked
                      </p>
                    </div>
                  </div>
                  
                  <svg className="w-6 h-6 text-primary group-hover:translate-x-1 transition-transform" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
                  </svg>
                </div>

                {/* Progress Bar */}
                {gamificationStats.achievements && (
                  <div className="mb-4">
                    <div className="flex items-center justify-between text-sm mb-2">
                      <span className="font-medium text-muted-foreground">Achievement Progress</span>
                      <span className="font-bold text-primary">
                        {((gamificationStats.achievements.unlocked_count / gamificationStats.achievements.total_count) * 100).toFixed(0)}%
                      </span>
                    </div>
                    <div className="relative h-3 bg-muted rounded-full overflow-hidden">
                      <div
                        className="absolute inset-y-0 left-0 bg-gradient-to-r from-primary to-accent rounded-full transition-all duration-500"
                        style={{ width: `${(gamificationStats.achievements.unlocked_count / gamificationStats.achievements.total_count) * 100}%` }}
                      />
                    </div>
                  </div>
                )}

                {/* Recent Achievements Preview */}
                {gamificationStats.achievements?.unlocked && gamificationStats.achievements.unlocked.length > 0 ? (
                  <div className="flex items-center gap-2 overflow-x-auto pb-2 scrollbar-hide">
                    <span className="text-xs font-medium text-muted-foreground whitespace-nowrap">Recent unlocked:</span>
                    {gamificationStats.achievements.unlocked.slice(0, 5).map((achievement) => (
                      <div 
                        key={achievement.id}
                        className="flex items-center gap-2 bg-card/50 backdrop-blur-sm border border-border rounded-lg px-3 py-2 whitespace-nowrap group-hover:scale-105 transition-transform"
                      >
                        <span className="text-lg">{achievement.icon}</span>
                        <span className="text-xs font-medium text-foreground">{achievement.name}</span>
                        <span className="text-xs text-primary font-bold">+{achievement.points}</span>
                      </div>
                    ))}
                  </div>
                ) : (
                  <div className="bg-muted/30 rounded-xl p-4 border border-border">
                    <p className="text-sm text-muted-foreground text-center">
                      🚀 Start tracking transactions to unlock your first achievement!
                    </p>
                  </div>
                )}
              </div>
            </Link>
          </div>
        )}

        {/* Analytics Grid */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 mb-8">
          {/* This Week's Spending */}
          <div className="bg-card/80 backdrop-blur-sm rounded-2xl p-8 border-2 border-border hover:border-primary/40 transition-all duration-300 hover:shadow-xl">
            <div className="flex items-start justify-between mb-6">
              <div>
                <h2 className="text-xl font-bold text-foreground mb-1">This Week's Spending</h2>
                <p className="text-sm text-muted-foreground">Your last 7 days</p>
              </div>
              <Link href="/analytics" className="text-primary text-sm font-medium hover:underline flex items-center gap-1">
                Details
                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
                </svg>
              </Link>
            </div>

            <div className="mb-6">
              <div className="flex items-baseline gap-3 mb-2">
                <span className="text-4xl font-bold text-foreground">
                  ${weeklySpending.thisWeek.toFixed(2)}
                </span>
                {weeklySpending.lastWeek > 0 && (
                  <span className={`text-xs font-bold px-2 py-1 rounded-full ${
                    weeklySpending.change > 0 
                      ? 'bg-danger/10 text-danger' 
                      : 'bg-success/10 text-success'
                  }`}>
                    {weeklySpending.change > 0 ? '↑' : '↓'} {Math.abs(weeklySpending.change).toFixed(0)}%
                  </span>
                )}
              </div>
              <p className="text-sm text-muted-foreground">vs ${weeklySpending.lastWeek.toFixed(2)} last week</p>
            </div>

            <div className="h-36 flex items-end gap-2">
              {weeklySpending.dailyData.map((value, index) => {
                const maxValue = Math.max(...weeklySpending.dailyData, 1);
                const height = maxValue > 0 ? (value / maxValue) * 100 : 0;
                const days = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'];
                
                return (
                  <div key={index} className="flex-1 flex flex-col items-center gap-2 group">
                    <div className="w-full">
                      {value > 0 ? (
                        <div 
                          className="w-full bg-primary/70 group-hover:bg-primary rounded-t-lg transition-all cursor-pointer"
                          style={{ height: `${Math.max(height, 8)}px` }}
                        />
                      ) : (
                        <div className="w-full h-2 bg-muted rounded" />
                      )}
                    </div>
                    <span className="text-xs text-muted-foreground">{days[index]}</span>
                  </div>
                );
              })}
            </div>
          </div>

          {/* Budget Health */}
          <div className="bg-card/80 backdrop-blur-sm rounded-2xl p-8 border-2 border-border hover:border-primary/40 transition-all duration-300 hover:shadow-xl">
            <div className="flex items-start justify-between mb-8">
              <div>
                <h2 className="text-xl font-bold text-foreground mb-1">Budget Health</h2>
                <p className="text-sm text-muted-foreground">Top 3 categories</p>
              </div>
              <Link href="/categories" className="text-primary text-sm font-medium hover:underline flex items-center gap-1">
                Manage
                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
                </svg>
              </Link>
            </div>

            {budgetHealth.length === 0 ? (
              <div className="text-center py-8">
                <p className="text-muted-foreground text-sm mb-3">No budget limits set</p>
                <Link href="/categories" className="text-primary text-sm hover:underline font-medium">
                  Set budget limits →
                </Link>
              </div>
            ) : (
              <div className="space-y-6">
                {budgetHealth.map((item, index) => (
                  <div key={index}>
                    <div className="flex items-center justify-between mb-2">
                      <span className="font-semibold text-foreground">{item.name}</span>
                      <span className={`text-sm font-bold ${
                        item.status === 'over' 
                          ? 'text-danger'
                          : item.status === 'warning'
                          ? 'text-warning'
                          : 'text-success'
                      }`}>
                        {item.percentage.toFixed(0)}%
                      </span>
                    </div>
                    <div className="w-full bg-muted rounded-full h-2 overflow-hidden">
                      <div
                        className={`h-full transition-all duration-500 rounded-full ${
                          item.status === 'over' 
                            ? 'bg-danger'
                            : item.status === 'warning'
                            ? 'bg-warning'
                            : 'bg-success'
                        }`}
                        style={{ width: `${Math.min(item.percentage, 100)}%` }}
                      />
                    </div>
                    <p className="text-xs text-muted-foreground mt-1">
                      ${item.spent.toFixed(2)} of ${item.budget.toFixed(2)}
                    </p>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>

        {/* Recent Transactions */}
        <div className="bg-card/80 backdrop-blur-sm rounded-2xl overflow-hidden border-2 border-border hover:border-primary/40 transition-all duration-300 hover:shadow-xl">
          <div className="p-6 border-b border-border">
            <div className="flex items-center justify-between">
              <div>
                <h2 className="text-xl font-bold text-foreground mb-1">Recent Transactions</h2>
                <p className="text-sm text-muted-foreground">Latest {recentTransactions.length} transactions</p>
              </div>
              <Link href="/transactions" className="text-primary text-sm font-medium hover:underline flex items-center gap-1">
                View all
                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
                </svg>
              </Link>
            </div>
          </div>

          {recentTransactions.length === 0 ? (
            <div className="p-12 text-center">
              <p className="text-muted-foreground mb-3">No transactions yet</p>
              <button
                onClick={() => setIsQuickAddOpen(true)}
                className="text-primary text-sm hover:underline font-medium"
              >
                Add your first transaction →
              </button>
            </div>
          ) : (
            <div>
              {recentTransactions.map((transaction, index) => {
                const icon = getCategoryIcon(transaction.category_name || '');
                const iconBg = transaction.category_name?.toLowerCase().includes('food') || transaction.category_name?.toLowerCase().includes('dining')
                  ? 'bg-warning/10'
                  : transaction.category_name?.toLowerCase().includes('shop')
                  ? 'bg-accent/10'
                  : transaction.category_name?.toLowerCase().includes('transport')
                  ? 'bg-primary/10'
                  : 'bg-muted';

                return (
                  <div 
                    key={transaction.id} 
                    className={`px-6 py-4 hover:bg-muted/30 transition-colors flex items-center justify-between group cursor-pointer ${
                      index !== recentTransactions.length - 1 ? 'border-b border-border' : ''
                    }`}
                  >
                    <div className="flex items-center gap-4">
                      <div className={`w-12 h-12 ${iconBg} rounded-xl flex items-center justify-center text-xl group-hover:scale-110 transition-transform`}>
                        {icon}
                      </div>
                      <div>
                        <p className="font-semibold text-foreground">
                          {transaction.note || transaction.category_name || 'Transaction'}
                        </p>
                        <p className="text-sm text-muted-foreground">
                          {transaction.category_name} • {new Date(transaction.spent_at).toLocaleDateString('en-US', { 
                            month: 'short', 
                            day: 'numeric'
                          })}
                        </p>
                      </div>
                    </div>
                    <span className="text-lg font-bold text-danger">
                      ${parseFloat(transaction.amount).toFixed(2)}
                    </span>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      </div>

      {/* Transaction Modal */}
      <TransactionModal
        isOpen={isQuickAddOpen}
        onClose={() => setIsQuickAddOpen(false)}
        onSuccess={fetchDashboardData}
        categories={categories}
        showTimeField={false}
        showCurrencyField={false}
        title="Quick Add"
      />
    </div>
  );
}