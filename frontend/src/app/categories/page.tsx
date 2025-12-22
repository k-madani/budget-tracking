'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { useDispatch } from 'react-redux';
import Link from 'next/link';
import api from '@/lib/api';
import { clearAuth } from '@/lib/authSlice';
import { toast } from 'react-hot-toast';

interface Category {
  id: string;
  name: string;
  type: 'INCOME' | 'EXPENSE';
  budget_limit?: number | null;
  current_spending?: number;
}

export default function CategoriesPage() {
  const router = useRouter();
  const dispatch = useDispatch();
  const [categories, setCategories] = useState<Category[]>([]);
  const [loading, setLoading] = useState(true);
  const [theme, setTheme] = useState<'light' | 'dark'>('dark');

  const [showAddModal, setShowAddModal] = useState(false);
  const [showEditModal, setShowEditModal] = useState(false);
  const [showDeleteModal, setShowDeleteModal] = useState(false);
  const [editingCategory, setEditingCategory] = useState<Category | null>(null);
  const [deletingCategory, setDeletingCategory] = useState<Category | null>(null);
  const [submitting, setSubmitting] = useState(false);

  const [name, setName] = useState('');
  const [type, setType] = useState<'INCOME' | 'EXPENSE'>('EXPENSE');
  const [budgetLimit, setBudgetLimit] = useState('');

  const [filterType, setFilterType] = useState<'all' | 'INCOME' | 'EXPENSE'>('all');

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

    fetchCategories();
  }, [router]);

  const toggleTheme = () => {
    const newTheme = theme === 'dark' ? 'light' : 'dark';
    setTheme(newTheme);
    localStorage.setItem('theme', newTheme);
    document.documentElement.classList.toggle('dark', newTheme === 'dark');
  };

  const fetchCategories = async () => {
    try {
      setLoading(true);
      const response = await api.get('/categories');
      setCategories(response.data || []);
    } catch (error: any) {
      console.error('Failed to fetch categories:', error);
      toast.error('Failed to load categories');
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

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!name.trim()) {
      toast.error('Please enter a category name');
      return;
    }

    setSubmitting(true);

    try {
      const payload: any = {
        name: name.trim(),
        type: type,
      };

      if (budgetLimit && type === 'EXPENSE') {
        payload.budget_limit = parseFloat(budgetLimit);
      }

      if (editingCategory) {
        await api.put(`/categories/${editingCategory.id}`, payload);
        toast.success('Category updated successfully');
      } else {
        await api.post('/categories', payload);
        toast.success('Category created successfully');
      }

      resetForm();
      fetchCategories();
    } catch (error: any) {
      console.error('Failed to save category:', error);
      const errorData = error.response?.data;
      let errorMsg = 'Failed to save category';
      
      if (typeof errorData === 'object') {
        const errors = Object.entries(errorData)
          .map(([key, value]) => `${key}: ${Array.isArray(value) ? value.join(', ') : value}`)
          .join('; ');
        errorMsg = errors;
      }
      
      toast.error(errorMsg);
    } finally {
      setSubmitting(false);
    }
  };

  const handleEdit = (category: Category) => {
    setEditingCategory(category);
    setName(category.name);
    setType(category.type);
    setBudgetLimit(category.budget_limit ? category.budget_limit.toString() : '');
    setShowEditModal(true);
  };

  const confirmDelete = (category: Category) => {
    setDeletingCategory(category);
    setShowDeleteModal(true);
  };

  const handleDelete = async () => {
    if (!deletingCategory) return;

    try {
      await api.delete(`/categories/${deletingCategory.id}`);
      setShowDeleteModal(false);
      setDeletingCategory(null);
      toast.success('Category deleted successfully');
      fetchCategories();
    } catch (error) {
      console.error('Failed to delete category:', error);
      toast.error('Failed to delete category. It may be in use by transactions.');
    }
  };

  const resetForm = () => {
    setName('');
    setType('EXPENSE');
    setBudgetLimit('');
    setEditingCategory(null);
    setShowAddModal(false);
    setShowEditModal(false);
  };

  const filteredCategories = categories.filter(cat => {
    if (filterType === 'all') return true;
    return cat.type === filterType;
  });

  const incomeCategories = filteredCategories.filter(c => c.type === 'INCOME');
  const expenseCategories = filteredCategories.filter(c => c.type === 'EXPENSE');

  if (loading) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <div className="text-center">
          <div className="w-16 h-16 border-4 border-primary border-t-transparent rounded-full animate-spin mx-auto mb-4" />
          <p className="text-muted-foreground">Loading categories...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background">
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
              <Link href="/dashboard" className="text-sm font-medium text-muted-foreground hover:text-foreground transition-colors">Dashboard</Link>
              <Link href="/transactions" className="text-sm font-medium text-muted-foreground hover:text-foreground transition-colors">Transactions</Link>
              <Link href="/categories" className="text-sm font-medium text-primary border-b-2 border-primary pb-0.5">Categories</Link>
              <Link href="/analytics" className="text-sm font-medium text-muted-foreground hover:text-foreground transition-colors">Analytics</Link>
              <Link href="/profile" className="text-sm font-medium text-muted-foreground hover:text-foreground transition-colors">Profile</Link>

              <button onClick={toggleTheme} className="p-2 rounded-lg border border-border hover:bg-accent transition-colors">
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
              
              <button onClick={handleLogout} className="text-sm font-medium text-muted-foreground hover:text-red-500 transition-colors flex items-center space-x-1">
                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 16l4-4m0 0l-4-4m4 4H7m6 4v1a3 3 0 01-3 3H6a3 3 0 01-3-3V7a3 3 0 013-3h4a3 3 0 013 3v1" />
                </svg>
                <span>Logout</span>
              </button>
            </div>
          </div>
        </div>
      </nav>

      <div className="max-w-7xl mx-auto px-6 lg:px-8 py-8">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between mb-8 gap-4">
          <div>
            <h1 className="text-3xl font-bold text-foreground mb-1">Categories</h1>
            <p className="text-muted-foreground">Organize your income and expenses</p>
          </div>

          <button
            onClick={() => setShowAddModal(true)}
            className="px-6 py-3 bg-primary text-white font-semibold rounded-xl hover:opacity-90 transition-opacity flex items-center space-x-2 shadow-lg"
          >
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 6v6m0 0v6m0-6h6m-6 0H6" />
            </svg>
            <span>Add Category</span>
          </button>
        </div>

        <div className="bg-card border border-border rounded-xl p-6 mb-8">
          <div className="flex items-center space-x-4">
            <span className="text-sm font-medium text-foreground">Filter:</span>
            <button
              onClick={() => setFilterType('all')}
              className={`px-4 py-2 rounded-lg text-sm font-medium transition-colors ${
                filterType === 'all' ? 'bg-primary text-white' : 'bg-background text-muted-foreground hover:text-foreground'
              }`}
            >
              All ({categories.length})
            </button>
            <button
              onClick={() => setFilterType('INCOME')}
              className={`px-4 py-2 rounded-lg text-sm font-medium transition-colors ${
                filterType === 'INCOME' ? 'bg-green-500 text-white' : 'bg-background text-muted-foreground hover:text-foreground'
              }`}
            >
              Income ({incomeCategories.length})
            </button>
            <button
              onClick={() => setFilterType('EXPENSE')}
              className={`px-4 py-2 rounded-lg text-sm font-medium transition-colors ${
                filterType === 'EXPENSE' ? 'bg-red-500 text-white' : 'bg-background text-muted-foreground hover:text-foreground'
              }`}
            >
              Expense ({expenseCategories.length})
            </button>
          </div>
        </div>

        {filteredCategories.length === 0 ? (
          <div className="text-center py-12 bg-card border border-border rounded-xl">
            <svg className="w-16 h-16 mx-auto text-muted-foreground/50 mb-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M7 7h.01M7 3h5c.512 0 1.024.195 1.414.586l7 7a2 2 0 010 2.828l-7 7a2 2 0 01-2.828 0l-7-7A1.994 1.994 0 013 12V7a4 4 0 014-4z" />
            </svg>
            <p className="text-muted-foreground">No categories found</p>
            <p className="text-sm text-muted-foreground mt-1">
              {filterType === 'all' ? 'Add your first category to get started' : `No ${filterType.toLowerCase()} categories yet`}
            </p>
            <button
              onClick={() => setShowAddModal(true)}
              className="mt-4 px-4 py-2 bg-primary text-white rounded-lg hover:opacity-90 transition-opacity text-sm font-medium"
            >
              Add Category
            </button>
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {filteredCategories.map((category) => {
              const percentage = category.budget_limit && category.current_spending
                ? (Number(category.current_spending) / Number(category.budget_limit)) * 100
                : 0;
              
              const isOverBudget = percentage > 100;
              const isNearLimit = percentage > 80 && percentage <= 100;

              return (
                <div key={category.id} className="bg-card border border-border rounded-xl p-6 hover:shadow-lg transition-shadow">
                  <div className="flex items-start justify-between mb-4">
                    <div className="flex items-center space-x-3">
                      <div className={`w-12 h-12 rounded-lg flex items-center justify-center ${category.type === 'INCOME' ? 'bg-green-500/10' : 'bg-red-500/10'}`}>
                        <svg className={`w-6 h-6 ${category.type === 'INCOME' ? 'text-green-500' : 'text-red-500'}`} fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d={category.type === 'INCOME' ? "M13 7h8m0 0v8m0-8l-8 8-4-4-6 6" : "M13 17h8m0 0V9m0 8l-8-8-4 4-6-6"} />
                        </svg>
                      </div>
                      <div>
                        <h3 className="font-semibold text-foreground">{category.name}</h3>
                        <span className={`text-xs font-medium ${category.type === 'INCOME' ? 'text-green-500' : 'text-red-500'}`}>
                          {category.type}
                        </span>
                      </div>
                    </div>

                    <div className="flex items-center space-x-1">
                      <button onClick={() => handleEdit(category)} className="p-2 text-muted-foreground hover:text-primary transition-colors" title="Edit">
                        <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" />
                        </svg>
                      </button>
                      <button onClick={() => confirmDelete(category)} className="p-2 text-muted-foreground hover:text-red-500 transition-colors" title="Delete">
                        <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                        </svg>
                      </button>
                    </div>
                  </div>

                  {category.type === 'EXPENSE' && (
                    <div className="mt-4">
                      {category.budget_limit ? (
                        <div>
                          <div className="flex justify-between text-sm mb-2">
                            <span className="text-muted-foreground">Spent this month:</span>
                            <span className={`font-semibold ${isOverBudget ? 'text-red-500' : isNearLimit ? 'text-yellow-500' : 'text-foreground'}`}>
                              ${(category.current_spending || 0).toFixed(2)} / ${Number(category.budget_limit).toFixed(2)}
                            </span>
                          </div>
                          
                          <div className="w-full h-2 bg-border rounded-full overflow-hidden">
                            <div 
                              className={`h-full transition-all duration-300 ${isOverBudget ? 'bg-red-500' : isNearLimit ? 'bg-yellow-500' : 'bg-primary'}`}
                              style={{ width: `${Math.min(percentage, 100)}%` }}
                            />
                          </div>

                          {isOverBudget && (
                            <p className="text-xs text-red-500 mt-2 flex items-center">
                              <svg className="w-3 h-3 mr-1" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
                              </svg>
                              Over budget by ${(Number(category.current_spending || 0) - Number(category.budget_limit)).toFixed(2)}
                            </p>
                          )}
                          {isNearLimit && !isOverBudget && (
                            <p className="text-xs text-yellow-500 mt-2 flex items-center">
                              <svg className="w-3 h-3 mr-1" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
                              </svg>
                              Approaching limit ({percentage.toFixed(0)}%)
                            </p>
                          )}
                        </div>
                      ) : (
                        <div className="text-sm text-muted-foreground">No budget limit set</div>
                      )}
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        )}
      </div>

      {showAddModal && (
        <div className="fixed inset-0 bg-black/50 backdrop-blur-sm flex items-center justify-center z-50 p-4">
          <div className="bg-card border border-border rounded-2xl max-w-md w-full p-6 shadow-2xl">
            <div className="flex items-center justify-between mb-6">
              <h2 className="text-2xl font-bold text-foreground">Add Category</h2>
              <button onClick={resetForm} className="p-2 rounded-lg hover:bg-muted transition-colors">
                <svg className="w-5 h-5 text-muted-foreground" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                </svg>
              </button>
            </div>

            <form onSubmit={handleSubmit} className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-foreground mb-2">
                  Category Name <span className="text-red-500">*</span>
                </label>
                <input
                  type="text"
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  required
                  placeholder="e.g., Groceries"
                  className="w-full px-4 py-2.5 bg-background border border-border rounded-lg text-foreground focus:outline-none focus:ring-2 focus:ring-primary"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-foreground mb-2">
                  Type <span className="text-red-500">*</span>
                </label>
                <div className="grid grid-cols-2 gap-3">
                  <button
                    type="button"
                    onClick={() => setType('EXPENSE')}
                    className={`py-2.5 px-4 rounded-lg font-medium transition-colors ${
                      type === 'EXPENSE' ? 'bg-red-500 text-white' : 'bg-background border border-border text-muted-foreground hover:text-foreground'
                    }`}
                  >
                    Expense
                  </button>
                  <button
                    type="button"
                    onClick={() => setType('INCOME')}
                    className={`py-2.5 px-4 rounded-lg font-medium transition-colors ${
                      type === 'INCOME' ? 'bg-green-500 text-white' : 'bg-background border border-border text-muted-foreground hover:text-foreground'
                    }`}
                  >
                    Income
                  </button>
                </div>
              </div>

              {type === 'EXPENSE' && (
                <div>
                  <label className="block text-sm font-medium text-foreground mb-2">
                    Monthly Budget Limit <span className="text-xs text-muted-foreground">(Optional)</span>
                  </label>
                  <input
                    type="number"
                    step="0.01"
                    min="0"
                    value={budgetLimit}
                    onChange={(e) => setBudgetLimit(e.target.value)}
                    placeholder="0.00"
                    className="w-full px-4 py-2.5 bg-background border border-border rounded-lg text-foreground focus:outline-none focus:ring-2 focus:ring-primary"
                  />
                  <p className="text-xs text-muted-foreground mt-1">Set a spending limit for this category per month</p>
                </div>
              )}

              <div className="flex space-x-3 pt-4">
                <button
                  type="button"
                  onClick={resetForm}
                  disabled={submitting}
                  className="flex-1 py-2.5 px-4 bg-background border border-border text-foreground rounded-lg hover:bg-muted transition-colors disabled:opacity-50"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={submitting}
                  className="flex-1 py-2.5 px-4 bg-primary text-white rounded-lg hover:opacity-90 transition-opacity font-semibold disabled:opacity-50"
                >
                  {submitting ? 'Adding...' : 'Add Category'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {showEditModal && editingCategory && (
        <div className="fixed inset-0 bg-black/50 backdrop-blur-sm flex items-center justify-center z-50 p-4">
          <div className="bg-card border border-border rounded-2xl max-w-md w-full p-6 shadow-2xl">
            <div className="flex items-center justify-between mb-6">
              <h2 className="text-2xl font-bold text-foreground">Edit Category</h2>
              <button onClick={resetForm} className="p-2 rounded-lg hover:bg-muted transition-colors">
                <svg className="w-5 h-5 text-muted-foreground" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                </svg>
              </button>
            </div>

            <form onSubmit={handleSubmit} className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-foreground mb-2">
                  Category Name <span className="text-red-500">*</span>
                </label>
                <input
                  type="text"
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  required
                  className="w-full px-4 py-2.5 bg-background border border-border rounded-lg text-foreground focus:outline-none focus:ring-2 focus:ring-primary"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-foreground mb-2">
                  Type <span className="text-red-500">*</span>
                </label>
                <div className="grid grid-cols-2 gap-3">
                  <button
                    type="button"
                    onClick={() => setType('EXPENSE')}
                    className={`py-2.5 px-4 rounded-lg font-medium transition-colors ${
                      type === 'EXPENSE' ? 'bg-red-500 text-white' : 'bg-background border border-border text-muted-foreground hover:text-foreground'
                    }`}
                  >
                    Expense
                  </button>
                  <button
                    type="button"
                    onClick={() => setType('INCOME')}
                    className={`py-2.5 px-4 rounded-lg font-medium transition-colors ${
                      type === 'INCOME' ? 'bg-green-500 text-white' : 'bg-background border border-border text-muted-foreground hover:text-foreground'
                    }`}
                  >
                    Income
                  </button>
                </div>
              </div>

              {type === 'EXPENSE' && (
                <div>
                  <label className="block text-sm font-medium text-foreground mb-2">
                    Monthly Budget Limit <span className="text-xs text-muted-foreground">(Optional)</span>
                  </label>
                  <input
                    type="number"
                    step="0.01"
                    min="0"
                    value={budgetLimit}
                    onChange={(e) => setBudgetLimit(e.target.value)}
                    placeholder="0.00"
                    className="w-full px-4 py-2.5 bg-background border border-border rounded-lg text-foreground focus:outline-none focus:ring-2 focus:ring-primary"
                  />
                </div>
              )}

              <div className="flex space-x-3 pt-4">
                <button
                  type="button"
                  onClick={resetForm}
                  disabled={submitting}
                  className="flex-1 py-2.5 px-4 bg-background border border-border text-foreground rounded-lg hover:bg-muted transition-colors disabled:opacity-50"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={submitting}
                  className="flex-1 py-2.5 px-4 bg-primary text-white rounded-lg hover:opacity-90 transition-opacity font-semibold disabled:opacity-50"
                >
                  {submitting ? 'Updating...' : 'Update Category'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {showDeleteModal && deletingCategory && (
        <div className="fixed inset-0 bg-black/50 backdrop-blur-sm flex items-center justify-center z-50 p-4">
          <div className="bg-card border border-border rounded-2xl max-w-md w-full p-6 shadow-2xl">
            <div className="flex items-center space-x-3 mb-4">
              <div className="w-12 h-12 rounded-full bg-red-500/10 flex items-center justify-center">
                <svg className="w-6 h-6 text-red-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
                </svg>
              </div>
              <div>
                <h3 className="text-lg font-bold text-foreground">Delete Category</h3>
                <p className="text-sm text-muted-foreground">This action cannot be undone</p>
              </div>
            </div>

            <div className="bg-muted/30 rounded-lg p-4 mb-6">
              <p className="text-sm text-foreground">
                Are you sure you want to delete <span className="font-semibold">{deletingCategory.name}</span>?
              </p>
              <p className="text-xs text-muted-foreground mt-2">
                This may affect transactions using this category.
              </p>
            </div>

            <div className="flex space-x-3">
              <button
                onClick={() => {
                  setShowDeleteModal(false);
                  setDeletingCategory(null);
                }}
                className="flex-1 py-2.5 px-4 bg-background border border-border text-foreground rounded-lg hover:bg-muted transition-colors"
              >
                Cancel
              </button>
              <button
                onClick={handleDelete}
                className="flex-1 py-2.5 px-4 bg-red-500 text-white rounded-lg hover:bg-red-600 transition-colors font-semibold"
              >
                Delete
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}