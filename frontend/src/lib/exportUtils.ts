// frontend/src/lib/exportUtils.ts

import * as XLSX from 'xlsx';
import jsPDF from 'jspdf';
import autoTable from 'jspdf-autotable';

interface Transaction {
  id: string;
  amount: string;
  currency: string;
  note: string;
  spent_at: string;
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

interface Summary {
  income: number;
  expense: number;
  balance: number;
}

// ==================== CSV EXPORT ====================

export const exportToCSV = (transactions: Transaction[], filename?: string) => {
  if (transactions.length === 0) {
    throw new Error('No transactions to export');
  }

  const headers = ['Date', 'Time', 'Type', 'Category', 'Note', 'Amount', 'Currency'];
  const rows = transactions.map(t => {
    const date = new Date(t.spent_at);
    return [
      date.toLocaleDateString(),
      date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
      t.category_type || 'N/A',
      t.category_name || 'Uncategorized',
      t.note || '',
      t.amount,
      t.currency
    ];
  });

  const csvContent = [
    headers.join(','),
    ...rows.map(row => row.map(cell => `"${cell}"`).join(','))
  ].join('\n');

  const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
  const link = document.createElement('a');
  const url = URL.createObjectURL(blob);
  
  link.setAttribute('href', url);
  link.setAttribute('download', filename || `budgetly_export_${new Date().toISOString().split('T')[0]}.csv`);
  link.style.visibility = 'hidden';
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
};

// ==================== EXCEL EXPORT ====================

export const exportToExcel = (
  transactions: Transaction[],
  categories: Category[],
  summary?: Summary
) => {
  const wb = XLSX.utils.book_new();

  // Sheet 1: Summary
  if (summary) {
    const summaryData = [
      ['Budgetly Financial Report', ''],
      ['Generated On', new Date().toLocaleString()],
      ['', ''],
      ['Financial Summary', ''],
      ['Total Income', summary.income.toFixed(2)],
      ['Total Expenses', summary.expense.toFixed(2)],
      ['Net Balance', summary.balance.toFixed(2)],
      ['Savings Rate', summary.income > 0 ? ((summary.balance / summary.income) * 100).toFixed(1) + '%' : '0%'],
    ];
    const summarySheet = XLSX.utils.aoa_to_sheet(summaryData);
    summarySheet['!cols'] = [{ width: 20 }, { width: 15 }];
    XLSX.utils.book_append_sheet(wb, summarySheet, 'Summary');
  }

  // Sheet 2: Transactions
  const transactionData = transactions.map(t => ({
    'Date': new Date(t.spent_at).toLocaleDateString(),
    'Time': new Date(t.spent_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
    'Type': t.category_type || 'N/A',
    'Category': t.category_name || 'Uncategorized',
    'Note': t.note || '',
    'Amount': parseFloat(t.amount).toFixed(2),
    'Currency': t.currency
  }));
  const transactionSheet = XLSX.utils.json_to_sheet(transactionData);
  transactionSheet['!cols'] = [
    { width: 12 }, { width: 8 }, { width: 10 }, { width: 15 }, 
    { width: 30 }, { width: 12 }, { width: 8 }
  ];
  XLSX.utils.book_append_sheet(wb, transactionSheet, 'Transactions');

  // Sheet 3: Categories
  const categoryData = categories.map(c => {
    const budgetLimit = Number(c.budget_limit) || 0;
    const currentSpending = Number(c.current_spending) || 0;
    const remaining = budgetLimit > 0 ? budgetLimit - currentSpending : 0;

    return {
      'Name': c.name,
      'Type': c.type,
      'Budget Limit': budgetLimit > 0 ? budgetLimit.toFixed(2) : 'No limit',
      'Current Spending': currentSpending.toFixed(2),
      'Remaining': budgetLimit > 0 ? remaining.toFixed(2) : '-',
      'Status': budgetLimit > 0 && currentSpending > budgetLimit * 0.9 ? 'Warning' : 'Good'
    };
  });
  const categorySheet = XLSX.utils.json_to_sheet(categoryData);
  categorySheet['!cols'] = [
    { width: 20 }, { width: 10 }, { width: 15 }, 
    { width: 18 }, { width: 15 }, { width: 10 }
  ];
  XLSX.utils.book_append_sheet(wb, categorySheet, 'Categories');

  // Sheet 4: Spending Analysis
  const expenseCategories = categories.filter(c => c.type === 'EXPENSE' && c.current_spending && c.current_spending > 0);
  
  if (expenseCategories.length > 0 && summary) {
    const spendingByCategory = expenseCategories
      .map(c => {
        const amountSpent = Number(c.current_spending) || 0;
        const percentage = ((amountSpent / summary.expense) * 100).toFixed(1);
        const budgetLimit = Number(c.budget_limit) || 0;

        return {
          category: c.name,
          amountSpent: amountSpent,
          percentage: percentage,
          budget: budgetLimit
        };
      })
      .sort((a, b) => b.amountSpent - a.amountSpent)
      .map(item => ({
        'Category': item.category,
        'Amount Spent': item.amountSpent.toFixed(2),
        'Percentage of Total': item.percentage + '%',
        'Budget': item.budget > 0 ? item.budget.toFixed(2) : 'No limit'
      }));

    const analysisSheet = XLSX.utils.json_to_sheet(spendingByCategory);
    analysisSheet['!cols'] = [{ width: 20 }, { width: 15 }, { width: 18 }, { width: 15 }];
    XLSX.utils.book_append_sheet(wb, analysisSheet, 'Spending Analysis');
  }

  const filename = `budgetly_export_${new Date().toISOString().split('T')[0]}.xlsx`;
  XLSX.writeFile(wb, filename);
};

// ==================== PDF EXPORT ====================

export const exportToPDF = (
  transactions: Transaction[],
  categories: Category[],
  summary?: Summary
) => {
  const doc = new jsPDF();
  const pageWidth = doc.internal.pageSize.getWidth();
  let yPos = 20;

  // Header
  doc.setFontSize(24);
  doc.setTextColor(59, 130, 246);
  doc.text('Budgetly Financial Report', pageWidth / 2, yPos, { align: 'center' });
  
  yPos += 10;
  doc.setFontSize(10);
  doc.setTextColor(100, 100, 100);
  doc.text(`Generated on ${new Date().toLocaleString()}`, pageWidth / 2, yPos, { align: 'center' });
  
  yPos += 15;

  // Summary Section
  if (summary) {
    doc.setFontSize(16);
    doc.setTextColor(0, 0, 0);
    doc.text('Financial Summary', 14, yPos);
    yPos += 8;

    const savingsRate = summary.income > 0 ? ((summary.balance / summary.income) * 100).toFixed(1) : '0';

    const summaryData = [
      ['Total Income', `$${summary.income.toFixed(2)}`],
      ['Total Expenses', `$${summary.expense.toFixed(2)}`],
      ['Net Balance', `$${summary.balance.toFixed(2)}`],
      ['Savings Rate', savingsRate + '%']
    ];

    autoTable(doc, {
      startY: yPos,
      head: [['Metric', 'Value']],
      body: summaryData,
      theme: 'grid',
      headStyles: { fillColor: [59, 130, 246], textColor: 255, fontStyle: 'bold' },
      margin: { left: 14, right: 14 },
      styles: { fontSize: 10 }
    });

    yPos = (doc as any).lastAutoTable.finalY + 15;
  }

  // Transactions Section
  doc.setFontSize(16);
  doc.setTextColor(0, 0, 0);
  doc.text('Recent Transactions', 14, yPos);
  yPos += 8;

  const transactionRows = transactions.slice(0, 100).map(t => {
    const date = new Date(t.spent_at);
    const amount = parseFloat(t.amount);
    const sign = t.category_type === 'INCOME' ? '+' : '-';
    
    return [
      date.toLocaleDateString(),
      date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
      t.category_type || 'N/A',
      t.category_name || 'Uncategorized',
      (t.note || '').substring(0, 25),
      `${sign}$${amount.toFixed(2)}`
    ];
  });

  autoTable(doc, {
    startY: yPos,
    head: [['Date', 'Time', 'Type', 'Category', 'Note', 'Amount']],
    body: transactionRows,
    theme: 'striped',
    headStyles: { fillColor: [59, 130, 246], textColor: 255, fontStyle: 'bold' },
    margin: { left: 14, right: 14 },
    styles: { fontSize: 8, cellPadding: 2 },
    columnStyles: {
      0: { cellWidth: 22 },
      1: { cellWidth: 18 },
      2: { cellWidth: 18 },
      3: { cellWidth: 30 },
      4: { cellWidth: 50 },
      5: { cellWidth: 22, halign: 'right' }
    }
  });

  // Categories Section - New Page
  doc.addPage();
  yPos = 20;

  doc.setFontSize(16);
  doc.setTextColor(0, 0, 0);
  doc.text('Categories & Budgets', 14, yPos);
  yPos += 8;

  const categoryRows = categories.map(c => {
    const spent = Number(c.current_spending) || 0;
    const budget = Number(c.budget_limit) || 0;
    const percentage = budget > 0 ? ((spent / budget) * 100).toFixed(0) + '%' : '-';

    return [
      c.name,
      c.type,
      budget > 0 ? `${budget.toFixed(2)}` : 'No limit',
      `${spent.toFixed(2)}`,
      percentage
    ];
  });

  autoTable(doc, {
    startY: yPos,
    head: [['Category', 'Type', 'Budget', 'Spent', 'Usage']],
    body: categoryRows,
    theme: 'grid',
    headStyles: { fillColor: [59, 130, 246], textColor: 255, fontStyle: 'bold' },
    margin: { left: 14, right: 14 },
    styles: { fontSize: 9, cellPadding: 3 }
  });

  // Footer on all pages
  const pageCount = doc.getNumberOfPages();
  for (let i = 1; i <= pageCount; i++) {
    doc.setPage(i);
    doc.setFontSize(8);
    doc.setTextColor(150, 150, 150);
    doc.text(
      `Budgetly - Page ${i} of ${pageCount}`,
      pageWidth / 2,
      doc.internal.pageSize.getHeight() - 10,
      { align: 'center' }
    );
  }

  const filename = `budgetly_report_${new Date().toISOString().split('T')[0]}.pdf`;
  doc.save(filename);
};