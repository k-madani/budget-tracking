// Replace entire file with this:

'use client';

import { useState, useEffect } from 'react';
import { toast } from 'react-hot-toast';
import api from '@/lib/api';

interface Category {
  id: string;
  name: string;
  type: string;
}

interface Transaction {
  id: string;
  amount: string;
  currency: string;
  note: string;
  spent_at: string;
  category: string | null;
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

interface TransactionModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSuccess: () => void;
  categories: Category[];
  editingTransaction?: Transaction | null;
  showTimeField?: boolean;
  showCurrencyField?: boolean;
  title?: string;
}

export default function TransactionModal({
  isOpen,
  onClose,
  onSuccess,
  categories,
  editingTransaction = null,
  showTimeField = false,
  showCurrencyField = false,
  title,
}: TransactionModalProps) {
  const [loading, setLoading] = useState(false);
  const [templates, setTemplates] = useState<Template[]>([]);
  const [showTemplates, setShowTemplates] = useState(false);
  const [savingAsTemplate, setSavingAsTemplate] = useState(false);
  const [templateName, setTemplateName] = useState('');
  
  const [formData, setFormData] = useState({
    amount: '',
    category: '',
    note: '',
    spent_at: new Date().toISOString().split('T')[0],
    spent_at_time: '12:00',
    currency: 'USD',
  });

  useEffect(() => {
    if (isOpen) {
      fetchTemplates();
    }
  }, [isOpen]);

  useEffect(() => {
    if (editingTransaction) {
      const spentDate = new Date(editingTransaction.spent_at);
      setFormData({
        amount: editingTransaction.amount,
        category: editingTransaction.category || '',
        note: editingTransaction.note || '',
        spent_at: spentDate.toISOString().split('T')[0],
        spent_at_time: spentDate.toTimeString().slice(0, 5),
        currency: editingTransaction.currency || 'USD',
      });
    } else {
      setFormData({
        amount: '',
        category: '',
        note: '',
        spent_at: new Date().toISOString().split('T')[0],
        spent_at_time: '12:00',
        currency: 'USD',
      });
    }
  }, [editingTransaction, isOpen]);

  const fetchTemplates = async () => {
    try {
      const response = await api.get('/templates');
      setTemplates(response.data || []);
    } catch (error) {
      console.error('Failed to fetch templates:', error);
    }
  };

  const handleUseTemplate = (template: Template) => {
    setFormData({
      ...formData,
      amount: template.amount,
      category: template.category,
      note: template.note || '',
      currency: template.currency,
    });
    setShowTemplates(false);
    toast.success(`Applied template: ${template.name}`);
  };

  const handleSaveAsTemplate = async () => {
    if (!templateName.trim()) {
      toast.error('Please enter a template name');
      return;
    }

    if (!formData.amount || !formData.category) {
      toast.error('Fill in amount and category first');
      return;
    }

    try {
      await api.post('/templates', {
        name: templateName.trim(),
        amount: parseFloat(formData.amount),
        category: formData.category,
        note: formData.note,
        currency: formData.currency,
        is_favorite: true
      });

      toast.success('Template saved!');
      setSavingAsTemplate(false);
      setTemplateName('');
      fetchTemplates();
    } catch (error: any) {
      console.error('Failed to save template:', error);
      toast.error(error.response?.data?.name?.[0] || 'Failed to save template');
    }
  };

  const handleDeleteTemplate = async (id: string, name: string) => {
    if (!confirm(`Delete template "${name}"?`)) return;
    
    try {
      await api.delete(`/templates/${id}`);
      toast.success('Template deleted');
      fetchTemplates();
    } catch (error) {
      toast.error('Failed to delete template');
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!formData.amount || !formData.category) {
      toast.error('Please fill in amount and category');
      return;
    }

    const amountNum = parseFloat(formData.amount);
    if (amountNum <= 0) {
      toast.error('Amount must be greater than 0');
      return;
    }

    setLoading(true);
    try {
      const spentAtISO = new Date(`${formData.spent_at}T${formData.spent_at_time}:00`).toISOString();
      
      const payload: any = {
        amount: amountNum,
        category: formData.category,
        note: formData.note.trim(),
        spent_at: spentAtISO,
        currency: formData.currency.toUpperCase(),
      };

      if (editingTransaction) {
        await api.put(`/transactions/${editingTransaction.id}`, payload);
        toast.success('Transaction updated! ✨');
      } else {
        await api.post('/transactions', payload);
        toast.success('Transaction added! 🎉');
      }
      
      setFormData({
        amount: '',
        category: '',
        note: '',
        spent_at: new Date().toISOString().split('T')[0],
        spent_at_time: '12:00',
        currency: 'USD',
      });
      
      onSuccess();
      onClose();
    } catch (error: any) {
      console.error('Error saving transaction:', error);
      toast.error('Failed to save transaction');
    } finally {
      setLoading(false);
    }
  };

  const handleClose = () => {
    if (!loading) {
      onClose();
      setShowTemplates(false);
      setSavingAsTemplate(false);
    }
  };

  if (!isOpen) return null;

  const expenseCategories = categories.filter(cat => cat.type === 'EXPENSE');
  const incomeCategories = categories.filter(cat => cat.type === 'INCOME');
  const modalTitle = title || (editingTransaction ? 'Edit Transaction' : 'Quick Add');

  return (
    <div 
      className="fixed inset-0 bg-black/50 backdrop-blur-sm flex items-center justify-center z-50 p-4"
      onClick={handleClose}
    >
      <div 
        className="bg-card border border-border rounded-2xl max-w-md w-full shadow-2xl max-h-[90vh] overflow-y-auto"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="flex items-center justify-between p-6 border-b border-border sticky top-0 bg-card z-10">
          <div>
            <h2 className="text-2xl font-bold text-foreground">{modalTitle}</h2>
            <p className="text-sm text-muted-foreground mt-1">
              {editingTransaction ? 'Update transaction details' : 'Add a transaction instantly'}
            </p>
          </div>
          <button
            onClick={handleClose}
            disabled={loading}
            className="text-muted-foreground hover:text-foreground transition-colors p-2 hover:bg-muted rounded-lg"
          >
            <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>

        {/* Templates Section */}
        {!editingTransaction && templates.length > 0 && (
          <div className="p-6 border-b border-border">
            <button
              onClick={() => setShowTemplates(!showTemplates)}
              className="w-full flex items-center justify-between text-left p-3 bg-primary/5 hover:bg-primary/10 border border-primary/20 rounded-lg transition-colors"
            >
              <div className="flex items-center space-x-2">
                <svg className="w-5 h-5 text-primary" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 6h16M4 12h16M4 18h16" />
                </svg>
                <span className="font-medium text-foreground">Quick Templates ({templates.length})</span>
              </div>
              <svg className={`w-5 h-5 text-primary transition-transform ${showTemplates ? 'rotate-180' : ''}`} fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
              </svg>
            </button>

            {showTemplates && (
              <div className="mt-3 space-y-2 max-h-48 overflow-y-auto">
                {templates.map((template) => (
                  <div key={template.id} className="flex items-center justify-between p-3 bg-background border border-border rounded-lg hover:shadow-md transition-shadow">
                    <button
                      onClick={() => handleUseTemplate(template)}
                      className="flex-1 text-left"
                    >
                      <div className="flex items-center space-x-2">
                        {template.is_favorite && <span className="text-yellow-500">⭐</span>}
                        <span className="font-medium text-foreground">{template.name}</span>
                      </div>
                      <div className="text-xs text-muted-foreground mt-1">
                        {template.category_name} • ${parseFloat(template.amount).toFixed(2)}
                      </div>
                    </button>
                    <button
                      onClick={() => handleDeleteTemplate(template.id, template.name)}
                      className="ml-2 p-1.5 text-muted-foreground hover:text-red-500 transition-colors"
                    >
                      <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                      </svg>
                    </button>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}

        {/* Form */}
        <form onSubmit={handleSubmit} className="p-6 space-y-5">
          <div>
            <label className="block text-sm font-medium text-foreground mb-2">
              Amount <span className="text-red-500">*</span>
            </label>
            <div className="relative">
              <span className="absolute left-4 top-1/2 -translate-y-1/2 text-muted-foreground font-medium">$</span>
              <input
                type="number"
                step="0.01"
                min="0.01"
                value={formData.amount}
                onChange={(e) => setFormData({ ...formData, amount: e.target.value })}
                className="w-full pl-8 pr-4 py-3 bg-background border border-border rounded-xl focus:ring-2 focus:ring-primary text-foreground text-lg font-semibold"
                placeholder="0.00"
                required
                autoFocus
              />
            </div>
          </div>

          <div>
            <label className="block text-sm font-medium text-foreground mb-2">
              Category <span className="text-red-500">*</span>
            </label>
            <select
              value={formData.category}
              onChange={(e) => setFormData({ ...formData, category: e.target.value })}
              className="w-full px-4 py-3 bg-background border border-border rounded-xl focus:ring-2 focus:ring-primary text-foreground"
              required
            >
              <option value="">Select a category</option>
              {expenseCategories.length > 0 && (
                <optgroup label="Expenses">
                  {expenseCategories.map((cat) => (
                    <option key={cat.id} value={cat.id}>{cat.name}</option>
                  ))}
                </optgroup>
              )}
              {incomeCategories.length > 0 && (
                <optgroup label="Income">
                  {incomeCategories.map((cat) => (
                    <option key={cat.id} value={cat.id}>{cat.name}</option>
                  ))}
                </optgroup>
              )}
            </select>
          </div>

          <div className={showTimeField ? 'grid grid-cols-2 gap-4' : ''}>
            <div>
              <label className="block text-sm font-medium text-foreground mb-2">
                Date <span className="text-red-500">*</span>
              </label>
              <input
                type="date"
                value={formData.spent_at}
                onChange={(e) => setFormData({ ...formData, spent_at: e.target.value })}
                className="w-full px-4 py-3 bg-background border border-border rounded-xl focus:ring-2 focus:ring-primary text-foreground"
                required
              />
            </div>
            {showTimeField && (
              <div>
                <label className="block text-sm font-medium text-foreground mb-2">Time</label>
                <input
                  type="time"
                  value={formData.spent_at_time}
                  onChange={(e) => setFormData({ ...formData, spent_at_time: e.target.value })}
                  className="w-full px-4 py-3 bg-background border border-border rounded-xl focus:ring-2 focus:ring-primary text-foreground"
                />
              </div>
            )}
          </div>

          {showCurrencyField && (
            <div>
              <label className="block text-sm font-medium text-foreground mb-2">Currency</label>
              <input
                type="text"
                value={formData.currency}
                onChange={(e) => setFormData({ ...formData, currency: e.target.value.toUpperCase() })}
                maxLength={3}
                placeholder="USD"
                className="w-full px-4 py-3 bg-background border border-border rounded-xl focus:ring-2 focus:ring-primary text-foreground"
              />
            </div>
          )}

          <div>
            <label className="block text-sm font-medium text-foreground mb-2">Note (optional)</label>
            <textarea
              value={formData.note}
              onChange={(e) => setFormData({ ...formData, note: e.target.value })}
              maxLength={255}
              rows={3}
              className="w-full px-4 py-3 bg-background border border-border rounded-xl focus:ring-2 focus:ring-primary text-foreground resize-none"
              placeholder="Add a note about this transaction..."
            />
          </div>

          {/* Save as Template */}
          {!editingTransaction && formData.amount && formData.category && (
            <div className="pt-4 border-t border-border">
              {!savingAsTemplate ? (
                <button
                  type="button"
                  onClick={() => setSavingAsTemplate(true)}
                  className="w-full text-sm text-primary hover:text-primary/80 font-medium flex items-center justify-center space-x-1"
                >
                  <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 5a2 2 0 012-2h10a2 2 0 012 2v16l-7-3.5L5 21V5z" />
                  </svg>
                  <span>Save as template</span>
                </button>
              ) : (
                <div className="space-y-2">
                  <input
                    type="text"
                    value={templateName}
                    onChange={(e) => setTemplateName(e.target.value)}
                    placeholder="Template name (e.g., Monthly Rent)"
                    className="w-full px-3 py-2 text-sm bg-background border border-border rounded-lg focus:ring-2 focus:ring-primary text-foreground"
                  />
                  <div className="flex space-x-2">
                    <button
                      type="button"
                      onClick={() => {
                        setSavingAsTemplate(false);
                        setTemplateName('');
                      }}
                      className="flex-1 px-3 py-1.5 text-sm bg-muted text-foreground rounded-lg"
                    >
                      Cancel
                    </button>
                    <button
                      type="button"
                      onClick={handleSaveAsTemplate}
                      className="flex-1 px-3 py-1.5 text-sm bg-primary text-white rounded-lg"
                    >
                      Save
                    </button>
                  </div>
                </div>
              )}
            </div>
          )}

          {/* Submit Buttons */}
          <div className="flex space-x-3 pt-4">
            <button
              type="button"
              onClick={handleClose}
              disabled={loading}
              className="flex-1 px-4 py-3 bg-muted hover:bg-muted/80 text-foreground rounded-xl font-medium transition-colors disabled:opacity-50"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={loading}
              className="flex-1 px-4 py-3 bg-primary hover:bg-primary/90 text-white rounded-xl font-medium transition-colors disabled:opacity-50 flex items-center justify-center space-x-2"
            >
              {loading ? (
                <>
                  <div className="w-5 h-5 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                  <span>Saving...</span>
                </>
              ) : (
                <>
                  <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                  </svg>
                  <span>{editingTransaction ? 'Update' : 'Add'}</span>
                </>
              )}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}