'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { useDispatch } from 'react-redux';
import Link from 'next/link';
import api from '@/lib/api';
import { clearAuth } from '@/lib/authSlice';
import { toast } from 'react-hot-toast';
import { exportToCSV, exportToExcel, exportToPDF } from '@/lib/exportUtils';
import Navbar from '@/components/Navbar';
import { LineChart, Line, PieChart, Pie, BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Cell, Legend } from 'recharts';

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
    budget_limit?: number | null;
    current_spending?: number;
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

const COLORS = ['#3B82F6', '#10B981', '#F59E0B', '#EF4444', '#8B5CF6', '#EC4899', '#14B8A6', '#F97316'];

export default function AnalyticsPage() {
    const router = useRouter();
    const dispatch = useDispatch();
    const [transactions, setTransactions] = useState<Transaction[]>([]);
    const [categories, setCategories] = useState<Category[]>([]);
    const [summary, setSummary] = useState<Summary | null>(null);
    const [loading, setLoading] = useState(true);
    const [theme, setTheme] = useState<'light' | 'dark'>('dark');
    const [timeRange, setTimeRange] = useState<'7days' | '30days' | 'all'>('30days');
    const [showExportMenu, setShowExportMenu] = useState(false);

    useEffect(() => {
        const token = localStorage.getItem('access_token');
        if (!token) {
            router.push('/login');
            return;
        }

        const savedTheme = localStorage.getItem('theme') as 'light' | 'dark' | null;
        const systemTheme = window.matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light';
        const initialTheme = savedTheme || systemTheme;

        setTheme(initialTheme);
        document.documentElement.classList.toggle('dark', initialTheme === 'dark');

        fetchData();
    }, [router]);

    const toggleTheme = () => {
        const newTheme = theme === 'dark' ? 'light' : 'dark';
        setTheme(newTheme);
        localStorage.setItem('theme', newTheme);
        document.documentElement.classList.toggle('dark', newTheme === 'dark');
    };

    const fetchData = async () => {
        try {
            setLoading(true);

            const [summaryRes, transactionsRes, categoriesRes] = await Promise.all([
                api.get('/transactions/summary'),
                api.get('/transactions'),
                api.get('/categories')
            ]);

            setSummary(summaryRes.data);

            const transactionData = transactionsRes.data as TransactionResponse;
            setTransactions(transactionData.results || []);

            setCategories(categoriesRes.data || []);
        } catch (error: any) {
            console.error('Failed to fetch data:', error);
            toast.error('Failed to load analytics data');
            if (error.response?.status === 401) {
                router.push('/login');
            }
        } finally {
            setLoading(false);
        }
    };

    const handleLogout = () => {
        try {
            localStorage.removeItem('access_token');
            localStorage.removeItem('refresh_token');
            dispatch(clearAuth());
            toast.success('Logged out successfully');
            router.push('/');
        } catch (error) {
            toast.error('Failed to logout');
        }
    };

    const handleExportCSV = () => {
        try {
            const filtered = getFilteredTransactions();
            if (filtered.length === 0) {
                toast.error('No data to export');
                return;
            }

            const headers = ['Date', 'Type', 'Category', 'Note', 'Amount', 'Currency'];
            const rows = filtered.map(t => [
                new Date(t.spent_at).toLocaleDateString(),
                t.category_type || 'N/A',
                t.category_name || 'Uncategorized',
                t.note || '',
                t.amount,
                t.currency
            ]);

            const csvContent = [
                headers.join(','),
                ...rows.map(row => row.map(cell => `"${cell}"`).join(','))
            ].join('\n');

            const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
            const link = document.createElement('a');
            const url = URL.createObjectURL(blob);
            
            link.setAttribute('href', url);
            link.setAttribute('download', `budgetly_analytics_${timeRange}_${new Date().toISOString().split('T')[0]}.csv`);
            link.style.visibility = 'hidden';
            document.body.appendChild(link);
            link.click();
            document.body.removeChild(link);

            toast.success('Analytics exported successfully');
        } catch (error) {
            console.error('Export error:', error);
            toast.error('Failed to export data');
        }
    };

    const getFilteredTransactions = () => {
        if (timeRange === 'all') return transactions;

        const now = new Date();
        const days = timeRange === '7days' ? 7 : 30;
        const cutoff = new Date(now.getTime() - days * 24 * 60 * 60 * 1000);

        return transactions.filter(t => new Date(t.spent_at) >= cutoff);
    };

    const getSpendingTrendData = () => {
        const filtered = getFilteredTransactions();
        const days = timeRange === '7days' ? 7 : timeRange === '30days' ? 30 : 90;
        const trendData = [];
        const today = new Date();

        for (let i = days - 1; i >= 0; i--) {
            const date = new Date(today);
            date.setDate(date.getDate() - i);
            const dateStr = date.toISOString().split('T')[0];

            const dayTransactions = filtered.filter(t =>
                t.spent_at.split('T')[0] === dateStr
            );

            const dayIncome = dayTransactions
                .filter(t => t.category_type === 'INCOME')
                .reduce((sum, t) => sum + parseFloat(t.amount), 0);

            const dayExpenses = dayTransactions
                .filter(t => t.category_type === 'EXPENSE')
                .reduce((sum, t) => sum + parseFloat(t.amount), 0);

            trendData.push({
                date: date.toLocaleDateString('en-US', { month: 'short', day: 'numeric' }),
                Income: dayIncome,
                Expenses: dayExpenses,
            });
        }

        return trendData;
    };

    const getCategoryBreakdown = () => {
        const filtered = getFilteredTransactions();

        const breakdown = categories
            .filter(cat => cat.type === 'EXPENSE')
            .map(cat => {
                const categoryTransactions = filtered.filter(
                    t => t.category === cat.id && t.category_type === 'EXPENSE'
                );
                const total = categoryTransactions.reduce(
                    (sum, t) => sum + parseFloat(t.amount),
                    0
                );

                return {
                    name: cat.name,
                    value: total,
                };
            })
            .filter(item => item.value > 0)
            .sort((a, b) => b.value - a.value);

        if (breakdown.length > 5) {
            const top5 = breakdown.slice(0, 5);
            const other = breakdown.slice(5).reduce((sum, item) => sum + item.value, 0);

            if (other > 0) {
                top5.push({ name: 'Other', value: other });
            }

            return top5;
        }

        return breakdown;
    };

    const getIncomeExpenseData = () => {
        const filtered = getFilteredTransactions();

        const totalIncome = filtered
            .filter(t => t.category_type === 'INCOME')
            .reduce((sum, t) => sum + parseFloat(t.amount), 0);

        const totalExpenses = filtered
            .filter(t => t.category_type === 'EXPENSE')
            .reduce((sum, t) => sum + parseFloat(t.amount), 0);

        return [
            { name: 'Income', amount: totalIncome },
            { name: 'Expenses', amount: totalExpenses },
        ];
    };

    const getBudgetVsActual = () => {
        return categories
            .filter(cat => cat.type === 'EXPENSE' && cat.budget_limit)
            .map(cat => {
                const budgetLimit = Number(cat.budget_limit) || 0;
                const currentSpending = Number(cat.current_spending) || 0;

                return {
                    category: cat.name,
                    Budget: budgetLimit,
                    Actual: currentSpending,
                };
            })
            .sort((a, b) => b.Actual - a.Actual)
            .slice(0, 6);
    };

    const detectSubscriptions = () => {
        const subscriptionKeywords = [
            'netflix', 'spotify', 'hulu', 'disney', 'prime', 'subscription',
            'membership', 'monthly', 'annual', 'gym', 'insurance', 'internet',
            'phone', 'rent', 'utilities', 'electric', 'water', 'gas'
        ];

        const potentialSubscriptions = new Map<string, Transaction[]>();

        transactions.forEach(t => {
            if (t.category_type !== 'EXPENSE') return;

            const note = t.note?.toLowerCase() || '';
            const isKeywordMatch = subscriptionKeywords.some(keyword => note.includes(keyword));

            if (isKeywordMatch) {
                const key = `${t.category_name}-${parseFloat(t.amount).toFixed(2)}`;
                if (!potentialSubscriptions.has(key)) {
                    potentialSubscriptions.set(key, []);
                }
                potentialSubscriptions.get(key)!.push(t);
            }
        });

        const subscriptions: Array<{
            name: string;
            amount: number;
            frequency: number;
            category: string;
            lastCharge: string;
        }> = [];

        potentialSubscriptions.forEach((txList, key) => {
            if (txList.length >= 2) {
                const latest = txList.sort((a, b) =>
                    new Date(b.spent_at).getTime() - new Date(a.spent_at).getTime()
                )[0];

                subscriptions.push({
                    name: latest.note || latest.category_name || 'Unknown',
                    amount: parseFloat(latest.amount),
                    frequency: txList.length,
                    category: latest.category_name || 'Uncategorized',
                    lastCharge: latest.spent_at,
                });
            }
        });

        return subscriptions.sort((a, b) => b.amount - a.amount);
    };

    const CustomLineTooltip = ({ active, payload, label }: any) => {
        if (active && payload && payload.length) {
            const activeData = payload.find((p: any) => p.value > 0);
            if (!activeData) return null;

            return (
                <div style={{
                    backgroundColor: theme === 'dark' ? '#1F2937' : '#FFFFFF',
                    border: `1px solid ${theme === 'dark' ? '#374151' : '#E5E7EB'}`,
                    borderRadius: '8px',
                    padding: '8px 12px',
                    boxShadow: '0 4px 6px rgba(0, 0, 0, 0.1)',
                }}>
                    <p style={{
                        color: theme === 'dark' ? '#F3F4F6' : '#1F2937',
                        fontWeight: '600',
                        fontSize: '12px',
                        marginBottom: '4px'
                    }}>
                        {label}
                    </p>
                    <p style={{
                        color: activeData.color,
                        fontSize: '12px',
                        fontWeight: '600'
                    }}>
                        {activeData.name}: ${activeData.value.toFixed(2)}
                    </p>
                </div>
            );
        }
        return null;
    };

    const CustomBudgetTooltip = ({ active, payload }: any) => {
        if (active && payload && payload.length > 0) {
            const data = payload[0];

            return (
                <div style={{
                    backgroundColor: theme === 'dark' ? '#1F2937' : '#FFFFFF',
                    border: `1px solid ${theme === 'dark' ? '#374151' : '#E5E7EB'}`,
                    borderRadius: '8px',
                    padding: '8px 12px',
                    boxShadow: '0 4px 6px rgba(0, 0, 0, 0.1)',
                }}>
                    <p style={{
                        color: theme === 'dark' ? '#F3F4F6' : '#1F2937',
                        fontWeight: '600',
                        fontSize: '12px',
                        marginBottom: '4px'
                    }}>
                        {data.payload.category}
                    </p>
                    <p style={{
                        color: data.fill,
                        fontSize: '12px',
                        fontWeight: '600'
                    }}>
                        {data.dataKey}: ${data.value.toFixed(2)}
                    </p>
                </div>
            );
        }
        return null;
    };

    const CustomIncomeExpenseTooltip = ({ active, payload }: any) => {
        if (active && payload && payload.length > 0) {
            const data = payload[0];

            return (
                <div style={{
                    backgroundColor: theme === 'dark' ? '#1F2937' : '#FFFFFF',
                    border: `1px solid ${theme === 'dark' ? '#374151' : '#E5E7EB'}`,
                    borderRadius: '8px',
                    padding: '8px 12px',
                    boxShadow: '0 4px 6px rgba(0, 0, 0, 0.1)',
                }}>
                    <p style={{
                        color: theme === 'dark' ? '#F3F4F6' : '#1F2937',
                        fontWeight: '600',
                        fontSize: '12px',
                        marginBottom: '4px'
                    }}>
                        {data.payload.name}
                    </p>
                    <p style={{
                        color: data.fill,
                        fontSize: '14px',
                        fontWeight: '700'
                    }}>
                        ${data.value.toFixed(2)}
                    </p>
                </div>
            );
        }
        return null;
    };

    if (loading) {
        return (
            <div className="min-h-screen bg-background flex items-center justify-center">
                <div className="text-center">
                    <div className="w-16 h-16 border-4 border-primary border-t-transparent rounded-full animate-spin mx-auto mb-4" />
                    <p className="text-muted-foreground">Loading analytics...</p>
                </div>
            </div>
        );
    }

    const categoryBreakdown = getCategoryBreakdown();
    const budgetVsActual = getBudgetVsActual();
    const incomeExpenseData = getIncomeExpenseData();
    const spendingTrend = getSpendingTrendData();
    const subscriptions = detectSubscriptions();
    const totalSubscriptionCost = subscriptions.reduce((sum, sub) => sum + sub.amount, 0);

    return (
        <div className="min-h-screen bg-background">
            <Navbar currentPage="analytics" />

            <div className="max-w-7xl mx-auto px-6 lg:px-8 py-8">
                <div className="flex flex-col sm:flex-row sm:items-center justify-between mb-8 gap-4">
                    <div>
                        <h1 className="text-3xl font-bold text-foreground mb-1">Analytics</h1>
                        <p className="text-muted-foreground">Detailed insights into your spending</p>
                    </div>

                    <div className="flex items-center space-x-3">
                        <button
                            onClick={handleExportCSV}
                            disabled={transactions.length === 0}
                            className="px-4 py-2 bg-background border border-border text-foreground font-medium rounded-lg hover:bg-muted transition-colors flex items-center space-x-2 disabled:opacity-50 disabled:cursor-not-allowed"
                        >
                            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 10v6m0 0l-3-3m3 3l3-3m2 8H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                            </svg>
                            <span>Export CSV</span>
                        </button>

                        <div className="flex items-center space-x-2 bg-card border border-border rounded-lg p-1">
                            <button
                                onClick={() => setTimeRange('7days')}
                                className={`px-4 py-2 rounded-md text-sm font-medium transition-colors ${timeRange === '7days' ? 'bg-primary text-white' : 'text-muted-foreground hover:text-foreground'}`}
                            >
                                7 Days
                            </button>
                            <button
                                onClick={() => setTimeRange('30days')}
                                className={`px-4 py-2 rounded-md text-sm font-medium transition-colors ${timeRange === '30days' ? 'bg-primary text-white' : 'text-muted-foreground hover:text-foreground'}`}
                            >
                                30 Days
                            </button>
                            <button
                                onClick={() => setTimeRange('all')}
                                className={`px-4 py-2 rounded-md text-sm font-medium transition-colors ${timeRange === 'all' ? 'bg-primary text-white' : 'text-muted-foreground hover:text-foreground'}`}
                            >
                                All Time
                            </button>
                        </div>
                    </div>
                </div>

                {transactions.length === 0 ? (
                    <div className="text-center py-12 bg-card border border-border rounded-xl">
                        <svg className="w-16 h-16 mx-auto text-muted-foreground/50 mb-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z" />
                        </svg>
                        <p className="text-muted-foreground mb-4">No transaction data available</p>
                        <Link href="/transactions" className="inline-block px-6 py-3 bg-primary text-white rounded-lg hover:opacity-90 transition-opacity font-medium">
                            Add your first transaction
                        </Link>
                    </div>
                ) : (
                    <>
                        {subscriptions.length > 0 && (
                            <div className="bg-gradient-to-br from-purple-500/10 to-pink-500/10 border border-purple-500/20 rounded-xl p-6 mb-8">
                                <div className="flex items-center justify-between mb-6">
                                    <div>
                                        <h2 className="text-xl font-bold text-foreground mb-1">Recurring Expenses Detected</h2>
                                        <p className="text-sm text-muted-foreground">Monitor your subscriptions and recurring costs</p>
                                    </div>
                                    <div className="text-right">
                                        <p className="text-sm text-muted-foreground">Total Monthly</p>
                                        <p className="text-2xl font-bold text-primary">${totalSubscriptionCost.toFixed(2)}</p>
                                    </div>
                                </div>

                                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                                    {subscriptions.map((sub, index) => (
                                        <div key={index} className="bg-card/50 backdrop-blur border border-border rounded-lg p-4">
                                            <div className="flex items-start justify-between mb-2">
                                                <div className="flex-1">
                                                    <h3 className="font-semibold text-foreground mb-1 truncate">{sub.name}</h3>
                                                    <p className="text-xs text-muted-foreground">{sub.category}</p>
                                                </div>
                                                <div className={`px-2 py-1 rounded text-xs font-medium ${sub.amount > 50 ? 'bg-red-500/10 text-red-500' : 'bg-green-500/10 text-green-500'}`}>
                                                    {sub.amount > 50 ? 'High' : 'Low'}
                                                </div>
                                            </div>
                                            <div className="flex items-center justify-between">
                                                <span className="text-2xl font-bold text-foreground">${sub.amount.toFixed(2)}</span>
                                                <span className="text-xs text-muted-foreground">{sub.frequency}x charged</span>
                                            </div>
                                            <p className="text-xs text-muted-foreground mt-2">
                                                Last: {new Date(sub.lastCharge).toLocaleDateString()}
                                            </p>
                                        </div>
                                    ))}
                                </div>

                                <div className="mt-4 p-4 bg-yellow-500/10 border border-yellow-500/20 rounded-lg">
                                    <div className="flex items-start space-x-2">
                                        <svg className="w-5 h-5 text-yellow-500 mt-0.5 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                                        </svg>
                                        <div className="flex-1">
                                            <p className="text-sm font-medium text-yellow-600 dark:text-yellow-500">
                                                Subscriptions account for ${totalSubscriptionCost.toFixed(2)}/month
                                            </p>
                                            <p className="text-xs text-muted-foreground mt-1">
                                                Review regularly to avoid unused subscriptions draining your budget
                                            </p>
                                        </div>
                                    </div>
                                </div>
                            </div>
                        )}

                        <div className="bg-card border border-border rounded-xl p-6 mb-8">
                            <h2 className="text-xl font-bold text-foreground mb-6">Spending Trend</h2>
                            <ResponsiveContainer width="100%" height={350}>
                                <LineChart data={spendingTrend} margin={{ top: 5, right: 30, left: 20, bottom: 5 }}>
                                    <CartesianGrid strokeDasharray="3 3" stroke={theme === 'dark' ? '#374151' : '#E5E7EB'} opacity={0.3} />
                                    <XAxis dataKey="date" stroke={theme === 'dark' ? '#6B7280' : '#9CA3AF'} style={{ fontSize: '12px' }} tick={{ fill: theme === 'dark' ? '#9CA3AF' : '#6B7280' }} tickLine={false} />
                                    <YAxis stroke={theme === 'dark' ? '#6B7280' : '#9CA3AF'} style={{ fontSize: '12px' }} tick={{ fill: theme === 'dark' ? '#9CA3AF' : '#6B7280' }} tickLine={false} tickFormatter={(value) => `$${value}`} />
                                    <Tooltip content={<CustomLineTooltip />} cursor={false} />
                                    <Legend wrapperStyle={{ paddingTop: '20px' }} iconType="line" />
                                    <Line type="monotone" dataKey="Expenses" stroke="#EF4444" strokeWidth={2.5} dot={false} activeDot={false} />
                                    <Line type="monotone" dataKey="Income" stroke="#10B981" strokeWidth={2.5} dot={false} activeDot={false} />
                                </LineChart>
                            </ResponsiveContainer>
                        </div>

                        <div className="grid grid-cols-1 lg:grid-cols-2 gap-8 mb-8">
                            <div className="bg-card border border-border rounded-xl p-6">
                                <h2 className="text-xl font-bold text-foreground mb-6">Expense Distribution</h2>
                                {categoryBreakdown.length > 0 ? (
                                    <>
                                        <ResponsiveContainer width="100%" height={280}>
                                            <PieChart>
                                                <Pie
                                                    data={categoryBreakdown}
                                                    cx="50%"
                                                    cy="50%"
                                                    innerRadius={70}
                                                    outerRadius={110}
                                                    fill="#8884d8"
                                                    dataKey="value"
                                                    paddingAngle={2}
                                                    label={(entry) => {
                                                        const total = categoryBreakdown.reduce((sum, cat) => sum + cat.value, 0);
                                                        const percentage = (entry.value / total) * 100;
                                                        if (percentage < 5) return null;
                                                        return `${percentage.toFixed(0)}%`;
                                                    }}
                                                    labelLine={false}
                                                >
                                                    {categoryBreakdown.map((entry, index) => (
                                                        <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} stroke="none" />
                                                    ))}
                                                </Pie>
                                                <Tooltip
                                                    contentStyle={{
                                                        backgroundColor: theme === 'dark' ? '#1F2937' : '#FFFFFF',
                                                        border: `1px solid ${theme === 'dark' ? '#374151' : '#E5E7EB'}`,
                                                        borderRadius: '8px',
                                                        padding: '8px 12px',
                                                        boxShadow: '0 4px 6px rgba(0, 0, 0, 0.1)',
                                                        color: theme === 'dark' ? '#F3F4F6' : '#1F2937'
                                                    }}
                                                    formatter={(value: any) => `$${value.toFixed(2)}`}
                                                    itemStyle={{ color: theme === 'dark' ? '#F3F4F6' : '#1F2937', fontSize: '12px' }}
                                                />
                                            </PieChart>
                                        </ResponsiveContainer>

                                        <div className="mt-4 space-y-2">
                                            {categoryBreakdown.map((item, index) => {
                                                const total = categoryBreakdown.reduce((sum, cat) => sum + cat.value, 0);
                                                const percentage = (item.value / total) * 100;

                                                return (
                                                    <div key={index} className="flex items-center justify-between py-1">
                                                        <div className="flex items-center space-x-2">
                                                            <div className="w-3 h-3 rounded-sm" style={{ backgroundColor: COLORS[index % COLORS.length] }} />
                                                            <span className="text-sm text-foreground">{item.name}</span>
                                                        </div>
                                                        <div className="text-sm">
                                                            <span className="font-semibold text-foreground">${item.value.toFixed(2)}</span>
                                                            <span className="text-muted-foreground ml-2">({percentage.toFixed(1)}%)</span>
                                                        </div>
                                                    </div>
                                                );
                                            })}
                                        </div>
                                    </>
                                ) : (
                                    <div className="h-[300px] flex items-center justify-center text-muted-foreground">
                                        <p>No expense data</p>
                                    </div>
                                )}
                            </div>

                            <div className="bg-card border border-border rounded-xl p-6">
                                <h2 className="text-xl font-bold text-foreground mb-6">Budget vs Actual</h2>
                                {budgetVsActual.length > 0 ? (
                                    <>
                                        <ResponsiveContainer width="100%" height={280}>
                                            <BarChart data={budgetVsActual} margin={{ top: 20, right: 30, left: 20, bottom: 60 }}>
                                                <CartesianGrid strokeDasharray="3 3" stroke={theme === 'dark' ? '#374151' : '#E5E7EB'} opacity={0.3} />
                                                <XAxis dataKey="category" stroke={theme === 'dark' ? '#6B7280' : '#9CA3AF'} style={{ fontSize: '11px' }} tick={{ fill: theme === 'dark' ? '#9CA3AF' : '#6B7280' }} tickLine={false} angle={-45} textAnchor="end" height={60} />
                                                <YAxis stroke={theme === 'dark' ? '#6B7280' : '#9CA3AF'} style={{ fontSize: '12px' }} tick={{ fill: theme === 'dark' ? '#9CA3AF' : '#6B7280' }} tickLine={false} tickFormatter={(value) => `$${value}`} />
                                                <Tooltip content={<CustomBudgetTooltip />} cursor={false} />
                                                <Legend wrapperStyle={{ paddingTop: '10px' }} iconType="rect" />
                                                <Bar dataKey="Budget" fill="#3B82F6" radius={[4, 4, 0, 0]} maxBarSize={35} />
                                                <Bar dataKey="Actual" radius={[4, 4, 0, 0]} maxBarSize={35}>
                                                    {budgetVsActual.map((entry, index) => (
                                                        <Cell key={`cell-${index}`} fill={entry.Actual > entry.Budget ? '#EF4444' : '#10B981'} />
                                                    ))}
                                                </Bar>
                                            </BarChart>
                                        </ResponsiveContainer>

                                        <div className="mt-4 space-y-2">
                                            {budgetVsActual.map((item, index) => {
                                                const difference = item.Actual - item.Budget;
                                                const isOver = difference > 0;
                                                const percentage = item.Budget > 0 ? Math.abs((difference / item.Budget) * 100) : 0;

                                                return (
                                                    <div key={index} className="flex items-center justify-between text-xs py-1">
                                                        <span className="text-muted-foreground">{item.category}</span>
                                                        <span className={`font-medium ${isOver ? 'text-red-500' : 'text-green-500'}`}>
                                                            {isOver ? '+' : '-'}${Math.abs(difference).toFixed(2)} ({isOver ? '+' : '-'}{percentage.toFixed(0)}%)
                                                        </span>
                                                    </div>
                                                );
                                            })}
                                        </div>
                                    </>
                                ) : (
                                    <div className="h-[340px] flex items-center justify-center text-muted-foreground">
                                        <div className="text-center">
                                            <svg className="w-12 h-12 mx-auto text-muted-foreground/50 mb-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z" />
                                            </svg>
                                            <p className="text-sm mb-2">No budget limits set</p>
                                            <Link href="/categories" className="text-xs text-primary hover:underline">
                                                Add budget limits to categories
                                            </Link>
                                        </div>
                                    </div>
                                )}
                            </div>
                        </div>

                        <div className="bg-card border border-border rounded-xl p-6 mb-8">
                            <h2 className="text-xl font-bold text-foreground mb-6">Income vs Expenses</h2>
                            <ResponsiveContainer width="100%" height={300}>
                                <BarChart data={incomeExpenseData} margin={{ top: 20, right: 30, left: 20, bottom: 5 }}>
                                    <CartesianGrid strokeDasharray="3 3" stroke={theme === 'dark' ? '#374151' : '#E5E7EB'} opacity={0.3} />
                                    <XAxis dataKey="name" stroke={theme === 'dark' ? '#6B7280' : '#9CA3AF'} style={{ fontSize: '14px' }} tick={{ fill: theme === 'dark' ? '#9CA3AF' : '#6B7280' }} tickLine={false} />
                                    <YAxis stroke={theme === 'dark' ? '#6B7280' : '#9CA3AF'} style={{ fontSize: '12px' }} tick={{ fill: theme === 'dark' ? '#9CA3AF' : '#6B7280' }} tickLine={false} tickFormatter={(value) => `$${value}`} />
                                    <Tooltip content={<CustomIncomeExpenseTooltip />} cursor={false} />
                                    <Bar dataKey="amount" radius={[8, 8, 0, 0]} maxBarSize={150}>
                                        {incomeExpenseData.map((entry, index) => (
                                            <Cell key={`cell-${index}`} fill={entry.name === 'Income' ? '#10B981' : '#EF4444'} />
                                        ))}
                                    </Bar>
                                </BarChart>
                            </ResponsiveContainer>

                            <div className="mt-6 grid grid-cols-3 gap-4">
                                <div className="bg-green-500/10 border border-green-500/20 rounded-lg p-4 text-center">
                                    <p className="text-xs text-muted-foreground mb-1">Total Income</p>
                                    <p className="text-xl font-bold text-green-600 dark:text-green-500">
                                        ${incomeExpenseData.find(d => d.name === 'Income')?.amount.toFixed(2) || '0.00'}
                                    </p>
                                </div>
                                <div className="bg-red-500/10 border border-red-500/20 rounded-lg p-4 text-center">
                                    <p className="text-xs text-muted-foreground mb-1">Total Expenses</p>
                                    <p className="text-xl font-bold text-red-600 dark:text-red-500">
                                        ${incomeExpenseData.find(d => d.name === 'Expenses')?.amount.toFixed(2) || '0.00'}
                                    </p>
                                </div>
                                <div className="bg-primary/10 border border-primary/20 rounded-lg p-4 text-center">
                                    <p className="text-xs text-muted-foreground mb-1">Net Savings</p>
                                    <p className="text-xl font-bold text-primary">
                                        ${((incomeExpenseData.find(d => d.name === 'Income')?.amount || 0) - (incomeExpenseData.find(d => d.name === 'Expenses')?.amount || 0)).toFixed(2)}
                                    </p>
                                </div>
                            </div>
                        </div>
                    </>
                )}
            </div>
        </div>
    );
}