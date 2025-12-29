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

interface Template {
  id: string;
  name: string;
  amount: string;
  currency: string;
  note: string;
  category: string;
  category_name: string;
  category_type: string;
  is_favorite: boolean;
}

interface StreakData {
  current: number;
  longest: number;
  status: string;
  message: string;
}

interface LevelData {
  current: number;
  total_points: number;
  points_to_next_level: number;
  progress_percentage: number;
}

export default function DashboardPage() {
  const router = useRouter();
  const [recentTransactions, setRecentTransactions] = useState<Transaction[]>([]);
  const [allTransactions, setAllTransactions] = useState<Transaction[]>([]);
  const [categories, setCategories] = useState<Category[]>([]);
  const [templates, setTemplates] = useState<Template[]>([]);
  const [loading, setLoading] = useState(true);
  const [streak, setStreak] = useState<StreakData | null>(null);
  const [level, setLevel] = useState<LevelData | null>(null);
  const [isQuickAddOpen, setIsQuickAddOpen] = useState(false);

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

      const [summaryRes, transactionsRes, categoriesRes, gamificationRes, templatesRes] = await Promise.all([
        api.get('/transactions/summary'),
        api.get('/transactions'),
        api.get('/categories'),
        api.get('/stats').catch(() => null),
        api.get('/templates').catch(() => ({ data: [] }))
      ]);

      if (summaryRes.data) {
        setBalance(summaryRes.data.balance || 0);
        setIncome(summaryRes.data.income || 0);
        setExpenses(summaryRes.data.expense || 0);
      }

      const allTxns = transactionsRes.data.results || transactionsRes.data || [];
      setAllTransactions(allTxns);
      setRecentTransactions(allTxns.slice(0, 5));

      setCategories(categoriesRes.data || []);
      setTemplates(templatesRes.data || []);

      if (gamificationRes?.data) {
        setStreak(gamificationRes.data.streak);
        setLevel(gamificationRes.data.level);
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

  const handleQuickAddFromTemplate = async (template: Template) => {
    try {
      const response = await api.post(`/templates/${template.id}/use`, {
        spent_at: new Date().toISOString()
      });

      toast.success(`Added ${template.name}! 🎉`);
      fetchDashboardData();
    } catch (error) {
      console.error('Failed to use template:', error);
      toast.error('Failed to add transaction');
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

  const weeklySpending = getWeeklySpending();
  const budgetHealth = getBudgetHealth();
  const favoriteTemplates = templates;

  if (loading) {
    return (
      <div className="min-h-screen bg-[#FAFAFA] dark:bg-background flex items-center justify-center">
        <div className="text-center">
          <div className="w-16 h-16 border-4 border-primary border-t-transparent rounded-full animate-spin mx-auto mb-4" />
          <p className="text-muted-foreground">Loading dashboard...</p>
        </div>
      </div>
    );
  }

  const savingsRate = income > 0 ? ((income - expenses) / income) * 100 : 0;

  return (
    <div className="min-h-screen bg-[#FAFAFA] dark:bg-background">
      <Navbar currentPage="dashboard" />

      <div className="max-w-7xl mx-auto px-6 lg:px-8 py-8">
        {/* Header */}
        <div className="flex items-center justify-between mb-12">
          <div>
            <h1 className="text-3xl font-bold text-foreground">Dashboard</h1>
            <p className="text-muted-foreground mt-1">Your financial overview</p>
          </div>
          <button
            onClick={() => setIsQuickAddOpen(true)}
            className="px-6 py-3 bg-primary hover:bg-primary/90 text-white font-semibold rounded-lg transition-colors"
          >
            + Add Transaction
          </button>
        </div>

        {/* Quick Actions - Favorite Templates */}
        {favoriteTemplates.length > 0 && (
          <div className="bg-gradient-to-br from-primary/5 via-transparent to-accent/5 border border-primary/20 rounded-xl p-6 mb-12">
            <div className="flex items-center justify-between mb-4">
              <div>
                <h2 className="text-lg font-bold text-foreground flex items-center space-x-2">
                  <span>⚡</span>
                  <span>Quick Actions</span>
                </h2>
                <p className="text-sm text-muted-foreground">1-click recurring transactions</p>
              </div>
              <Link href="/templates" className="text-sm text-primary hover:underline font-medium">
                Manage Templates →
              </Link>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              {favoriteTemplates.map((template) => (
                <button
                  key={template.id}
                  onClick={() => handleQuickAddFromTemplate(template)}
                  className="group relative overflow-hidden bg-white dark:bg-card border-2 border-border hover:border-primary/50 rounded-xl p-5 transition-all hover:shadow-lg hover:scale-105"
                >
                  <div className="flex items-start justify-between mb-3">
                    <div className="flex items-center space-x-2">
                      <span className="text-2xl">⭐</span>
                      <div className="text-left">
                        <h3 className="font-bold text-foreground group-hover:text-primary transition-colors">
                          {template.name}
                        </h3>
                        <p className="text-xs text-muted-foreground">{template.category_name}</p>
                      </div>
                    </div>
                    <div className={`px-2 py-1 rounded text-xs font-medium ${
                      template.category_type === 'INCOME' 
                        ? 'bg-green-500/10 text-green-600'
                        : 'bg-red-500/10 text-red-600'
                    }`}>
                      {template.category_type === 'INCOME' ? '+' : '-'}${parseFloat(template.amount).toFixed(2)}
                    </div>
                  </div>
                  
                  <div className="flex items-center justify-between text-xs text-muted-foreground">
                    <span>{template.note || 'No note'}</span>
                    <div className="flex items-center space-x-1 text-primary opacity-0 group-hover:opacity-100 transition-opacity">
                      <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
                      </svg>
                      <span className="font-medium">Add Now</span>
                    </div>
                  </div>

                  <div className="absolute bottom-0 left-0 right-0 h-1 bg-primary transform scale-x-0 group-hover:scale-x-100 transition-transform origin-left" />
                </button>
              ))}
            </div>
          </div>
        )}

        {/* 1. SUMMARY - Hero Stats */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-12">
          <div className="bg-white dark:bg-card rounded-xl p-6 border border-gray-200 dark:border-border">
            <p className="text-sm text-muted-foreground mb-2">Current Balance</p>
            <p className="text-4xl font-bold text-foreground">${balance.toFixed(2)}</p>
          </div>
          
          <div className="bg-white dark:bg-card rounded-xl p-6 border border-gray-200 dark:border-border">
            <p className="text-sm text-muted-foreground mb-2">Total Income</p>
            <p className="text-4xl font-bold text-green-600 dark:text-green-500">${income.toFixed(2)}</p>
          </div>
          
          <div className="bg-white dark:bg-card rounded-xl p-6 border border-gray-200 dark:border-border">
            <p className="text-sm text-muted-foreground mb-2">Total Expenses</p>
            <p className="text-4xl font-bold text-red-600 dark:text-red-500">${expenses.toFixed(2)}</p>
          </div>
        </div>

        {/* 3. ANALYTICS & BUDGET HEALTH */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-8 mb-12">
          {/* This Week's Spending */}
          <div className="bg-white dark:bg-card rounded-xl p-6 border border-gray-200 dark:border-border">
            <div className="flex items-center justify-between mb-6">
              <h2 className="text-xl font-bold text-foreground">This Week's Spending</h2>
              <Link href="/analytics" className="text-sm text-primary hover:underline">
                Details →
              </Link>
            </div>

            <div className="mb-6">
              <div className="flex items-baseline space-x-3 mb-2">
                <span className="text-4xl font-bold text-foreground">
                  ${weeklySpending.thisWeek.toFixed(2)}
                </span>
                {weeklySpending.lastWeek > 0 && (
                  <span className={`text-sm font-semibold px-2 py-1 rounded ${
                    weeklySpending.change > 0 
                      ? 'bg-red-100 dark:bg-red-500/20 text-red-600 dark:text-red-400' 
                      : 'bg-green-100 dark:bg-green-500/20 text-green-600 dark:text-green-400'
                  }`}>
                    {weeklySpending.change > 0 ? '↑' : '↓'} {Math.abs(weeklySpending.change).toFixed(0)}%
                  </span>
                )}
              </div>
              <p className="text-sm text-muted-foreground">vs ${weeklySpending.lastWeek.toFixed(2)} last week</p>
            </div>

            <div className="h-32 flex items-end space-x-2">
              {weeklySpending.dailyData.map((value, index) => {
                const maxValue = Math.max(...weeklySpending.dailyData, 1);
                const height = maxValue > 0 ? (value / maxValue) * 100 : 0;
                const days = ['M', 'T', 'W', 'T', 'F', 'S', 'S'];
                
                return (
                  <div key={index} className="flex-1 flex flex-col items-center">
                    <div className="w-full relative group">
                      {value > 0 ? (
                        <>
                          <div 
                            className="w-full bg-primary rounded-t hover:bg-primary/80 transition-colors cursor-pointer"
                            style={{ height: `${Math.max(height * 1.2, 8)}px` }}
                          />
                          <div className="absolute -top-8 left-1/2 -translate-x-1/2 opacity-0 group-hover:opacity-100 bg-gray-900 dark:bg-gray-100 text-white dark:text-gray-900 text-xs px-2 py-1 rounded whitespace-nowrap transition-opacity">
                            ${value.toFixed(0)}
                          </div>
                        </>
                      ) : (
                        <div className="w-full h-1 bg-gray-200 dark:bg-muted rounded" />
                      )}
                    </div>
                    <span className="text-xs text-muted-foreground mt-2">{days[index]}</span>
                  </div>
                );
              })}
            </div>
          </div>

          {/* Budget Health */}
          <div className="bg-white dark:bg-card rounded-xl p-6 border border-gray-200 dark:border-border">
            <div className="flex items-center justify-between mb-6">
              <h2 className="text-xl font-bold text-foreground">Budget Health</h2>
              <Link href="/categories" className="text-sm text-primary hover:underline">
                Manage →
              </Link>
            </div>

            {budgetHealth.length === 0 ? (
              <div className="text-center py-8">
                <p className="text-muted-foreground text-sm mb-3">No budget limits set</p>
                <Link href="/categories" className="text-primary text-sm hover:underline">
                  Set budget limits →
                </Link>
              </div>
            ) : (
              <div className="space-y-6">
                {budgetHealth.map((item, index) => (
                  <div key={index}>
                    <div className="flex items-center justify-between mb-2">
                      <span className="font-semibold text-foreground">{item.name}</span>
                      <span className={`font-bold ${
                        item.status === 'over' 
                          ? 'text-red-600 dark:text-red-400'
                          : item.status === 'warning'
                          ? 'text-yellow-600 dark:text-yellow-400'
                          : 'text-green-600 dark:text-green-400'
                      }`}>
                        {item.percentage.toFixed(0)}%
                      </span>
                    </div>
                    <div className="w-full bg-gray-200 dark:bg-muted rounded-full h-2 overflow-hidden">
                      <div
                        className={`h-full transition-all duration-500 ${
                          item.status === 'over' 
                            ? 'bg-red-600 dark:bg-red-500'
                            : item.status === 'warning'
                            ? 'bg-yellow-500 dark:bg-yellow-400'
                            : 'bg-green-600 dark:bg-green-500'
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

        {/* 4. RECENT TRANSACTIONS */}
        <div className="bg-white dark:bg-card rounded-xl border border-gray-200 dark:border-border">
          <div className="p-6 border-b border-gray-200 dark:border-border">
            <div className="flex items-center justify-between">
              <h2 className="text-xl font-bold text-foreground">Recent Transactions</h2>
              <Link href="/transactions" className="text-sm text-primary hover:underline">
                View all →
              </Link>
            </div>
          </div>

          {recentTransactions.length === 0 ? (
            <div className="p-12 text-center">
              <p className="text-muted-foreground mb-3">No transactions yet</p>
              <button
                onClick={() => setIsQuickAddOpen(true)}
                className="text-primary text-sm hover:underline"
              >
                Add your first transaction
              </button>
            </div>
          ) : (
            <div className="divide-y divide-gray-200 dark:divide-border">
              {recentTransactions.map((transaction) => (
                <div 
                  key={transaction.id} 
                  className="p-4 hover:bg-gray-50 dark:hover:bg-muted/50 transition-colors flex items-center justify-between"
                >
                  <div className="flex items-center space-x-4">
                    <div className={`w-10 h-10 rounded-full flex items-center justify-center ${
                      transaction.category_type === 'INCOME' 
                        ? 'bg-green-100 dark:bg-green-500/20' 
                        : 'bg-red-100 dark:bg-red-500/20'
                    }`}>
                      <div className={`w-2 h-2 rounded-full ${
                        transaction.category_type === 'INCOME' ? 'bg-green-600' : 'bg-red-600'
                      }`} />
                    </div>
                    <div>
                      <p className="font-medium text-foreground">
                        {transaction.category_name || 'Uncategorized'}
                      </p>
                      <p className="text-sm text-muted-foreground">
                        {new Date(transaction.spent_at).toLocaleDateString('en-US', { 
                          month: 'short', 
                          day: 'numeric'
                        })}
                      </p>
                    </div>
                  </div>
                  <span className={`font-bold text-lg ${
                    transaction.category_type === 'INCOME' 
                      ? 'text-green-600 dark:text-green-500' 
                      : 'text-red-600 dark:text-red-500'
                  }`}>
                    {transaction.category_type === 'INCOME' ? '+' : '-'}${parseFloat(transaction.amount).toFixed(2)}
                  </span>
                </div>
              ))}
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