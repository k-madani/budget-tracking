'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { useDispatch } from 'react-redux';
import Link from 'next/link';
import api from '@/lib/api';
import { clearAuth } from '@/lib/authSlice';
import { toast } from 'react-hot-toast';
import Navbar from '@/components/Navbar';

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

  const [showAddModal, setShowAddModal] = useState(false);
  const [showEditModal, setShowEditModal] = useState(false);
  const [showDeleteModal, setShowDeleteModal] = useState(false);
  const [showFilterModal, setShowFilterModal] = useState(false);
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

    fetchCategories();
  }, [router]);

  const fetchCategories = async () => {
    try {
      setLoading(true);
      const response = await api.get('/categories');
      setCategories(response.data.results || []);
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

  const hasActiveFilters = filterType !== 'all';

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
      <Navbar currentPage="categories" />

      <div className="max-w-7xl mx-auto px-6 lg:px-8 py-8">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between mb-8 gap-4">
          <div>
            <h1 className="text-3xl font-bold text-foreground mb-1">Categories</h1>
            <p className="text-muted-foreground">Organize your income and expenses</p>
          </div>

          <div className="flex items-center space-x-3">
            {/* Filter Button */}
            <button
              onClick={() => setShowFilterModal(true)}
              className={`relative px-4 py-3 bg-card/80 backdrop-blur-sm border-2 ${
                hasActiveFilters ? 'border-primary' : 'border-border'
              } text-foreground font-medium rounded-xl hover:shadow-lg transition-all hover:-translate-y-0.5 flex items-center space-x-2`}
            >
              <svg className={`w-5 h-5 ${hasActiveFilters ? 'text-primary' : 'text-muted-foreground'}`} fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 4a1 1 0 011-1h16a1 1 0 011 1v2.586a1 1 0 01-.293.707l-6.414 6.414a1 1 0 00-.293.707V17l-4 4v-6.586a1 1 0 00-.293-.707L3.293 7.293A1 1 0 013 6.586V4z" />
              </svg>
              <span>Filter</span>
              {hasActiveFilters && (
                <div className="absolute -top-1 -right-1 w-3 h-3 bg-primary rounded-full animate-pulse" />
              )}
            </button>

            <button
              onClick={() => setShowAddModal(true)}
              className="px-6 py-3 bg-primary text-white font-semibold rounded-xl hover:opacity-90 transition-all shadow-lg hover:shadow-xl hover:scale-105 flex items-center space-x-2"
            >
              <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 6v6m0 0v6m0-6h6m-6 0H6" />
              </svg>
              <span>Add Category</span>
            </button>
          </div>
        </div>

        {/* Active Filter Indicator */}
        {hasActiveFilters && (
          <div className="mb-6 flex items-center justify-between bg-primary/10 border-2 border-primary/20 rounded-xl px-4 py-3">
            <div className="flex items-center space-x-2">
              <svg className="w-4 h-4 text-primary" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 4a1 1 0 011-1h16a1 1 0 011 1v2.586a1 1 0 01-.293.707l-6.414 6.414a1 1 0 00-.293.707V17l-4 4v-6.586a1 1 0 00-.293-.707L3.293 7.293A1 1 0 013 6.586V4z" />
              </svg>
              <span className="text-sm font-medium text-foreground">
                Showing: <span className="text-primary">{filterType === 'INCOME' ? 'Income Only' : 'Expense Only'}</span>
              </span>
            </div>
            <button
              onClick={() => setFilterType('all')}
              className="text-sm text-primary hover:underline font-medium"
            >
              Clear Filter
            </button>
          </div>
        )}

        {filteredCategories.length === 0 ? (
          <div className="text-center py-12 bg-card/80 backdrop-blur-sm border-2 border-border rounded-2xl">
            <svg className="w-16 h-16 mx-auto text-muted-foreground/50 mb-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M7 7h.01M7 3h5c.512 0 1.024.195 1.414.586l7 7a2 2 0 010 2.828l-7 7a2 2 0 01-2.828 0l-7-7A1.994 1.994 0 013 12V7a4 4 0 014-4z" />
            </svg>
            <p className="text-muted-foreground">No categories found</p>
            <p className="text-sm text-muted-foreground mt-1">
              {hasActiveFilters ? 'Try clearing the filter' : 'Add your first category to get started'}
            </p>
            {hasActiveFilters ? (
              <button
                onClick={() => setFilterType('all')}
                className="mt-4 px-4 py-2 bg-primary text-white rounded-xl hover:opacity-90 transition-opacity text-sm font-medium"
              >
                Clear Filter
              </button>
            ) : (
              <button
                onClick={() => setShowAddModal(true)}
                className="mt-4 px-4 py-2 bg-primary text-white rounded-xl hover:opacity-90 transition-opacity text-sm font-medium"
              >
                Add Category
              </button>
            )}
          </div>
        ) : (
          <>
            {/* Income Categories Section */}
            {incomeCategories.length > 0 && (
              <div className="mb-10">
                <div className="flex items-center space-x-3 mb-4">
                  <div className="w-8 h-8 rounded-lg bg-success/10 flex items-center justify-center">
                    <svg className="w-5 h-5 text-success" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 7h8m0 0v8m0-8l-8 8-4-4-6 6" />
                    </svg>
                  </div>
                  <h2 className="text-xl font-bold text-foreground">Income Categories</h2>
                  <span className="text-sm text-muted-foreground">({incomeCategories.length})</span>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                  {incomeCategories.map((category) => (
                    <CategoryCard
                      key={category.id}
                      category={category}
                      onEdit={handleEdit}
                      onDelete={confirmDelete}
                    />
                  ))}
                </div>
              </div>
            )}

            {/* Expense Categories Section */}
            {expenseCategories.length > 0 && (
              <div>
                <div className="flex items-center space-x-3 mb-4">
                  <div className="w-8 h-8 rounded-lg bg-danger/10 flex items-center justify-center">
                    <svg className="w-5 h-5 text-danger" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 17h8m0 0V9m0 8l-8-8-4 4-6-6" />
                    </svg>
                  </div>
                  <h2 className="text-xl font-bold text-foreground">Expense Categories</h2>
                  <span className="text-sm text-muted-foreground">({expenseCategories.length})</span>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                  {expenseCategories.map((category) => (
                    <CategoryCard
                      key={category.id}
                      category={category}
                      onEdit={handleEdit}
                      onDelete={confirmDelete}
                    />
                  ))}
                </div>
              </div>
            )}
          </>
        )}
      </div>

      {/* Filter Modal */}
      {showFilterModal && (
        <div className="fixed inset-0 bg-black/50 backdrop-blur-sm flex items-center justify-center z-50 p-4">
          <div className="bg-card/95 backdrop-blur-sm border-2 border-border rounded-2xl max-w-md w-full p-6 shadow-2xl">
            <div className="flex items-center justify-between mb-6">
              <h2 className="text-2xl font-bold text-foreground">Filter Categories</h2>
              <button onClick={() => setShowFilterModal(false)} className="p-2 rounded-lg hover:bg-muted transition-colors">
                <svg className="w-5 h-5 text-muted-foreground" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                </svg>
              </button>
            </div>

            <div className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-foreground mb-3">Category Type</label>
                <div className="space-y-2">
                  <button
                    onClick={() => setFilterType('all')}
                    className={`w-full py-3 px-4 rounded-xl font-medium transition-all text-left flex items-center justify-between ${
                      filterType === 'all' 
                        ? 'bg-primary text-white shadow-lg' 
                        : 'bg-muted border-2 border-border text-foreground hover:bg-muted/80'
                    }`}
                  >
                    <span>All Categories</span>
                    {filterType === 'all' && (
                      <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                      </svg>
                    )}
                  </button>
                  
                  <button
                    onClick={() => setFilterType('INCOME')}
                    className={`w-full py-3 px-4 rounded-xl font-medium transition-all text-left flex items-center justify-between ${
                      filterType === 'INCOME' 
                        ? 'bg-success text-white shadow-lg' 
                        : 'bg-muted border-2 border-border text-foreground hover:bg-muted/80'
                    }`}
                  >
                    <span>Income Only</span>
                    {filterType === 'INCOME' && (
                      <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                      </svg>
                    )}
                  </button>
                  
                  <button
                    onClick={() => setFilterType('EXPENSE')}
                    className={`w-full py-3 px-4 rounded-xl font-medium transition-all text-left flex items-center justify-between ${
                      filterType === 'EXPENSE' 
                        ? 'bg-danger text-white shadow-lg' 
                        : 'bg-muted border-2 border-border text-foreground hover:bg-muted/80'
                    }`}
                  >
                    <span>Expense Only</span>
                    {filterType === 'EXPENSE' && (
                      <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                      </svg>
                    )}
                  </button>
                </div>
              </div>

              <button
                onClick={() => setShowFilterModal(false)}
                className="w-full py-3 px-4 bg-primary text-white rounded-xl hover:opacity-90 transition-opacity font-semibold"
              >
                Apply Filter
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Add Category Modal */}
      {showAddModal && (
        <div className="fixed inset-0 bg-black/50 backdrop-blur-sm flex items-center justify-center z-50 p-4">
          <div className="bg-card/95 backdrop-blur-sm border-2 border-border rounded-2xl max-w-md w-full p-6 shadow-2xl">
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
                  className="w-full px-4 py-2.5 bg-background border-2 border-border rounded-xl text-foreground focus:outline-none focus:ring-2 focus:ring-primary"
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
                    className={`py-2.5 px-4 rounded-xl font-medium transition-all ${
                      type === 'EXPENSE' ? 'bg-danger text-white shadow-lg' : 'bg-muted border-2 border-border text-muted-foreground hover:text-foreground'
                    }`}
                  >
                    Expense
                  </button>
                  <button
                    type="button"
                    onClick={() => setType('INCOME')}
                    className={`py-2.5 px-4 rounded-xl font-medium transition-all ${
                      type === 'INCOME' ? 'bg-success text-white shadow-lg' : 'bg-muted border-2 border-border text-muted-foreground hover:text-foreground'
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
                    className="w-full px-4 py-2.5 bg-background border-2 border-border rounded-xl text-foreground focus:outline-none focus:ring-2 focus:ring-primary"
                  />
                  <p className="text-xs text-muted-foreground mt-1">Set a spending limit for this category per month</p>
                </div>
              )}

              <div className="flex space-x-3 pt-4">
                <button
                  type="button"
                  onClick={resetForm}
                  disabled={submitting}
                  className="flex-1 py-2.5 px-4 bg-muted border-2 border-border text-foreground rounded-xl hover:bg-muted/80 transition-colors disabled:opacity-50"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={submitting}
                  className="flex-1 py-2.5 px-4 bg-primary text-white rounded-xl hover:opacity-90 transition-opacity font-semibold disabled:opacity-50"
                >
                  {submitting ? 'Adding...' : 'Add Category'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Edit Category Modal */}
      {showEditModal && editingCategory && (
        <div className="fixed inset-0 bg-black/50 backdrop-blur-sm flex items-center justify-center z-50 p-4">
          <div className="bg-card/95 backdrop-blur-sm border-2 border-border rounded-2xl max-w-md w-full p-6 shadow-2xl">
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
                  className="w-full px-4 py-2.5 bg-background border-2 border-border rounded-xl text-foreground focus:outline-none focus:ring-2 focus:ring-primary"
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
                    className={`py-2.5 px-4 rounded-xl font-medium transition-all ${
                      type === 'EXPENSE' ? 'bg-danger text-white shadow-lg' : 'bg-muted border-2 border-border text-muted-foreground hover:text-foreground'
                    }`}
                  >
                    Expense
                  </button>
                  <button
                    type="button"
                    onClick={() => setType('INCOME')}
                    className={`py-2.5 px-4 rounded-xl font-medium transition-all ${
                      type === 'INCOME' ? 'bg-success text-white shadow-lg' : 'bg-muted border-2 border-border text-muted-foreground hover:text-foreground'
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
                    className="w-full px-4 py-2.5 bg-background border-2 border-border rounded-xl text-foreground focus:outline-none focus:ring-2 focus:ring-primary"
                  />
                </div>
              )}

              <div className="flex space-x-3 pt-4">
                <button
                  type="button"
                  onClick={resetForm}
                  disabled={submitting}
                  className="flex-1 py-2.5 px-4 bg-muted border-2 border-border text-foreground rounded-xl hover:bg-muted/80 transition-colors disabled:opacity-50"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={submitting}
                  className="flex-1 py-2.5 px-4 bg-primary text-white rounded-xl hover:opacity-90 transition-opacity font-semibold disabled:opacity-50"
                >
                  {submitting ? 'Updating...' : 'Update Category'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Delete Confirmation Modal */}
      {showDeleteModal && deletingCategory && (
        <div className="fixed inset-0 bg-black/50 backdrop-blur-sm flex items-center justify-center z-50 p-4">
          <div className="bg-card/95 backdrop-blur-sm border-2 border-border rounded-2xl max-w-md w-full p-6 shadow-2xl">
            <div className="flex items-center space-x-3 mb-4">
              <div className="w-12 h-12 rounded-full bg-danger/10 flex items-center justify-center">
                <svg className="w-6 h-6 text-danger" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
                </svg>
              </div>
              <div>
                <h3 className="text-lg font-bold text-foreground">Delete Category</h3>
                <p className="text-sm text-muted-foreground">This action cannot be undone</p>
              </div>
            </div>

            <div className="bg-muted/30 rounded-xl p-4 mb-6">
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
                className="flex-1 py-2.5 px-4 bg-muted border-2 border-border text-foreground rounded-xl hover:bg-muted/80 transition-colors"
              >
                Cancel
              </button>
              <button
                onClick={handleDelete}
                className="flex-1 py-2.5 px-4 bg-danger text-white rounded-xl hover:bg-danger/90 transition-colors font-semibold"
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

// Category Card Component
function CategoryCard({
  category,
  onEdit,
  onDelete
}: {
  category: Category;
  onEdit: (c: Category) => void;
  onDelete: (c: Category) => void;
}) {
  const percentage = category.budget_limit && category.current_spending
    ? (Number(category.current_spending) / Number(category.budget_limit)) * 100
    : 0;
  
  const isOverBudget = percentage > 100;
  const isNearLimit = percentage > 80 && percentage <= 100;

  return (
    <div className="group bg-card/80 backdrop-blur-sm border-2 border-border rounded-2xl p-6 hover:border-primary/40 transition-all duration-300 hover:shadow-xl hover:-translate-y-1">
      <div className="flex items-start justify-between mb-4">
        <div className="flex items-center space-x-3">
          <div className={`w-12 h-12 rounded-xl flex items-center justify-center group-hover:scale-110 transition-transform ${
            category.type === 'INCOME' ? 'bg-success/10' : 'bg-danger/10'
          }`}>
            <svg className={`w-6 h-6 ${category.type === 'INCOME' ? 'text-success' : 'text-danger'}`} fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d={category.type === 'INCOME' ? "M13 7h8m0 0v8m0-8l-8 8-4-4-6 6" : "M13 17h8m0 0V9m0 8l-8-8-4 4-6-6"} />
            </svg>
          </div>
          <div>
            <h3 className="font-semibold text-foreground">{category.name}</h3>
            <span className={`text-xs font-medium ${category.type === 'INCOME' ? 'text-success' : 'text-danger'}`}>
              {category.type}
            </span>
          </div>
        </div>

        <div className="flex items-center space-x-1 opacity-0 group-hover:opacity-100 transition-opacity">
          <button onClick={() => onEdit(category)} className="p-2 text-muted-foreground hover:text-primary transition-colors hover:bg-primary/10 rounded-lg" title="Edit">
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" />
            </svg>
          </button>
          <button onClick={() => onDelete(category)} className="p-2 text-muted-foreground hover:text-danger transition-colors hover:bg-danger/10 rounded-lg" title="Delete">
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
                <span className={`font-semibold ${isOverBudget ? 'text-danger' : isNearLimit ? 'text-warning' : 'text-foreground'}`}>
                  ${(category.current_spending || 0).toFixed(2)} / ${Number(category.budget_limit).toFixed(2)}
                </span>
              </div>
              
              <div className="w-full h-2 bg-muted rounded-full overflow-hidden">
                <div 
                  className={`h-full transition-all duration-300 ${isOverBudget ? 'bg-danger' : isNearLimit ? 'bg-warning' : 'bg-primary'}`}
                  style={{ width: `${Math.min(percentage, 100)}%` }}
                />
              </div>

              {isOverBudget && (
                <p className="text-xs text-danger mt-2 flex items-center">
                  <svg className="w-3 h-3 mr-1" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
                  </svg>
                  Over budget by ${(Number(category.current_spending || 0) - Number(category.budget_limit)).toFixed(2)}
                </p>
              )}
              {isNearLimit && !isOverBudget && (
                <p className="text-xs text-warning mt-2 flex items-center">
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
}