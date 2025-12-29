'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import api from '@/lib/api';
import { toast } from 'react-hot-toast';
import Navbar from '@/components/Navbar';

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
  created_at: string;
}

export default function TemplatesPage() {
  const router = useRouter();
  const [templates, setTemplates] = useState<Template[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const token = localStorage.getItem('access_token');
    if (!token) {
      router.push('/login');
      return;
    }

    fetchTemplates();
  }, [router]);

  const fetchTemplates = async () => {
    try {
      setLoading(true);
      const response = await api.get('/templates');
      setTemplates(response.data || []);
    } catch (error: any) {
      console.error('Failed to fetch templates:', error);
      toast.error('Failed to load templates');
      if (error.response?.status === 401) {
        router.push('/login');
      }
    } finally {
      setLoading(false);
    }
  };

  const handleToggleFavorite = async (template: Template) => {
    try {
      await api.put(`/templates/${template.id}`, {
        is_favorite: !template.is_favorite
      });

      toast.success(template.is_favorite ? 'Removed from favorites ⭐' : 'Added to favorites ⭐');
      fetchTemplates();
    } catch (error) {
      toast.error('Failed to update template');
    }
  };

  const handleDelete = async (template: Template) => {
    if (!confirm(`Delete template "${template.name}"?\n\nThis won't affect existing transactions.`)) return;

    try {
      await api.delete(`/templates/${template.id}`);
      toast.success('Template deleted');
      fetchTemplates();
    } catch (error) {
      toast.error('Failed to delete template');
    }
  };

  const handleUseTemplate = async (template: Template) => {
    try {
      await api.post(`/templates/${template.id}/use`, {
        spent_at: new Date().toISOString()
      });

      toast.success(`Added ${template.name}! 🎉`);
      router.push('/transactions');
    } catch (error) {
      toast.error('Failed to add transaction');
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <div className="text-center">
          <div className="w-16 h-16 border-4 border-primary border-t-transparent rounded-full animate-spin mx-auto mb-4" />
          <p className="text-muted-foreground">Loading templates...</p>
        </div>
      </div>
    );
  }

  const favoriteTemplates = templates.filter(t => t.is_favorite);
  const regularTemplates = templates.filter(t => !t.is_favorite);

  return (
    <div className="min-h-screen bg-background">
      <Navbar currentPage="transactions" />

      <div className="max-w-7xl mx-auto px-6 lg:px-8 py-8">
        <div className="flex items-center justify-between mb-8">
          <div>
            <h1 className="text-3xl font-bold text-foreground mb-1">Transaction Templates</h1>
            <p className="text-muted-foreground">Manage your recurring transactions</p>
          </div>
          <Link
            href="/transactions"
            className="px-6 py-3 bg-primary text-white font-semibold rounded-lg hover:opacity-90 transition-opacity flex items-center space-x-2"
          >
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 19l-7-7m0 0l7-7m-7 7h18" />
            </svg>
            <span>Back to Transactions</span>
          </Link>
        </div>

        {templates.length === 0 ? (
          <div className="text-center py-20 bg-card border border-border rounded-xl">
            <svg className="w-20 h-20 mx-auto text-muted-foreground/50 mb-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 5a2 2 0 012-2h10a2 2 0 012 2v16l-7-3.5L5 21V5z" />
            </svg>
            <p className="text-lg text-foreground font-semibold mb-2">No templates yet</p>
            <p className="text-sm text-muted-foreground mb-6">
              Templates let you quickly add recurring transactions with one click
            </p>
            <Link
              href="/transactions"
              className="inline-flex items-center px-6 py-3 bg-primary text-white font-semibold rounded-lg hover:opacity-90 transition-opacity"
            >
              <svg className="w-5 h-5 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 6v6m0 0v6m0-6h6m-6 0H6" />
              </svg>
              Create Your First Template
            </Link>
          </div>
        ) : (
          <>
            {/* Favorites Section */}
            {favoriteTemplates.length > 0 && (
              <div className="mb-10">
                <div className="flex items-center space-x-2 mb-4">
                  <h2 className="text-xl font-bold text-foreground">Favorites</h2>
                  <span className="text-sm text-muted-foreground">({favoriteTemplates.length})</span>
                </div>
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                  {favoriteTemplates.map((template) => (
                    <TemplateCard
                      key={template.id}
                      template={template}
                      onUse={handleUseTemplate}
                      onToggleFavorite={handleToggleFavorite}
                      onDelete={handleDelete}
                    />
                  ))}
                </div>
              </div>
            )}

            {/* All Templates Section */}
            {regularTemplates.length > 0 && (
              <div>
                <div className="flex items-center space-x-2 mb-4">
                  <h2 className="text-xl font-bold text-foreground">All Templates</h2>
                  <span className="text-sm text-muted-foreground">({regularTemplates.length})</span>
                </div>
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                  {regularTemplates.map((template) => (
                    <TemplateCard
                      key={template.id}
                      template={template}
                      onUse={handleUseTemplate}
                      onToggleFavorite={handleToggleFavorite}
                      onDelete={handleDelete}
                    />
                  ))}
                </div>
              </div>
            )}
          </>
        )}
      </div>
    </div>
  );
}

function TemplateCard({
  template,
  onUse,
  onToggleFavorite,
  onDelete
}: {
  template: Template;
  onUse: (t: Template) => void;
  onToggleFavorite: (t: Template) => void;
  onDelete: (t: Template) => void;
}) {
  return (
    <div className="group bg-card border border-border rounded-xl p-5 hover:shadow-lg transition-all">
      <div className="flex items-start justify-between mb-3">
        <div className="flex-1 min-w-0 pr-2">
          <h3 className="font-bold text-foreground mb-1 truncate">{template.name}</h3>
          <p className="text-xs text-muted-foreground truncate">{template.category_name}</p>
        </div>
        <div className={`flex-shrink-0 px-3 py-1 rounded-lg text-sm font-bold ${
          template.category_type === 'INCOME'
            ? 'bg-green-500/10 text-green-600'
            : 'bg-red-500/10 text-red-600'
        }`}>
          {template.category_type === 'INCOME' ? '+' : '-'}${parseFloat(template.amount).toFixed(2)}
        </div>
      </div>

      {template.note && (
        <p className="text-sm text-muted-foreground mb-4 line-clamp-2 h-10">{template.note}</p>
      )}

      <div className="flex items-center space-x-2 mt-4">
        <button
          onClick={() => onUse(template)}
          className="flex-1 px-4 py-2.5 bg-primary text-white rounded-lg hover:opacity-90 transition-opacity text-sm font-semibold flex items-center justify-center space-x-1"
        >
          <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
          </svg>
          <span>Use Now</span>
        </button>
        
        <button
          onClick={() => onToggleFavorite(template)}
          className={`p-2.5 rounded-lg transition-all ${
            template.is_favorite
              ? 'bg-yellow-500/20 text-yellow-600 hover:bg-yellow-500/30'
              : 'bg-background text-muted-foreground hover:bg-muted hover:text-yellow-600'
          }`}
          title={template.is_favorite ? 'Remove from favorites' : 'Add to favorites'}
        >
          <svg className="w-5 h-5" fill={template.is_favorite ? 'currentColor' : 'none'} stroke="currentColor" viewBox="0 0 24 24" strokeWidth={template.is_favorite ? 0 : 2}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M11.049 2.927c.3-.921 1.603-.921 1.902 0l1.519 4.674a1 1 0 00.95.69h4.915c.969 0 1.371 1.24.588 1.81l-3.976 2.888a1 1 0 00-.363 1.118l1.518 4.674c.3.922-.755 1.688-1.538 1.118l-3.976-2.888a1 1 0 00-1.176 0l-3.976 2.888c-.783.57-1.838-.197-1.538-1.118l1.518-4.674a1 1 0 00-.363-1.118l-3.976-2.888c-.784-.57-.38-1.81.588-1.81h4.914a1 1 0 00.951-.69l1.519-4.674z" />
          </svg>
        </button>
        
        <button
          onClick={() => onDelete(template)}
          className="p-2.5 bg-background text-muted-foreground hover:text-red-500 hover:bg-red-500/10 rounded-lg transition-colors"
          title="Delete template"
        >
          <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
          </svg>
        </button>
      </div>
    </div>
  );
}