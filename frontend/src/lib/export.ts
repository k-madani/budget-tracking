interface ExportTransaction {
  spent_at: string;
  category_type?: string;
  category_name?: string;
  note: string;
  amount: string;
  currency: string;
}

export const exportToCSV = (transactions: ExportTransaction[], filename: string = 'budgetly_transactions') => {
  if (transactions.length === 0) {
    throw new Error('No transactions to export');
  }

  const headers = ['Date', 'Type', 'Category', 'Note', 'Amount', 'Currency'];
  
  const rows = transactions.map(t => {
    const date = new Date(t.spent_at).toLocaleDateString();
    return [
      date,
      t.category_type || 'N/A',
      t.category_name || 'Uncategorized',
      (t.note || '').replace(/,/g, ';'), // Escape commas
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
  
  const timestamp = new Date().toISOString().split('T')[0];
  const finalFilename = `${filename}_${timestamp}.csv`;
  
  link.setAttribute('href', url);
  link.setAttribute('download', finalFilename);
  link.style.visibility = 'hidden';
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
};

export const exportToExcel = (transactions: ExportTransaction[], filename: string = 'budgetly_transactions') => {
  // For Excel, we'll use CSV format which Excel can open
  // A proper Excel export would require xlsx library
  exportToCSV(transactions, filename);
};

export const exportToPDF = async (transactions: ExportTransaction[], summary: any) => {
  // Create a printable HTML table
  const htmlContent = `
    <!DOCTYPE html>
    <html>
    <head>
      <title>Budgetly Transactions Report</title>
      <style>
        body { font-family: Arial, sans-serif; padding: 40px; }
        h1 { color: #1F2937; margin-bottom: 10px; }
        .summary { background: #F3F4F6; padding: 20px; border-radius: 8px; margin-bottom: 30px; }
        .summary-item { display: inline-block; margin-right: 40px; }
        .summary-label { font-size: 12px; color: #6B7280; }
        .summary-value { font-size: 24px; font-weight: bold; color: #1F2937; }
        table { width: 100%; border-collapse: collapse; }
        th { background: #1F2937; color: white; padding: 12px; text-align: left; }
        td { padding: 10px; border-bottom: 1px solid #E5E7EB; }
        tr:hover { background: #F9FAFB; }
        .income { color: #10B981; font-weight: bold; }
        .expense { color: #EF4444; font-weight: bold; }
      </style>
    </head>
    <body>
      <h1>Budgetly Transaction Report</h1>
      <p style="color: #6B7280; margin-bottom: 30px;">Generated on ${new Date().toLocaleDateString()}</p>
      
      <div class="summary">
        <div class="summary-item">
          <div class="summary-label">Total Income</div>
          <div class="summary-value" style="color: #10B981;">$${summary?.income?.toFixed(2) || '0.00'}</div>
        </div>
        <div class="summary-item">
          <div class="summary-label">Total Expenses</div>
          <div class="summary-value" style="color: #EF4444;">$${summary?.expense?.toFixed(2) || '0.00'}</div>
        </div>
        <div class="summary-item">
          <div class="summary-label">Balance</div>
          <div class="summary-value" style="color: #3B82F6;">$${summary?.balance?.toFixed(2) || '0.00'}</div>
        </div>
      </div>

      <table>
        <thead>
          <tr>
            <th>Date</th>
            <th>Type</th>
            <th>Category</th>
            <th>Note</th>
            <th>Amount</th>
          </tr>
        </thead>
        <tbody>
          ${transactions.map(t => `
            <tr>
              <td>${new Date(t.spent_at).toLocaleDateString()}</td>
              <td>${t.category_type || 'N/A'}</td>
              <td>${t.category_name || 'Uncategorized'}</td>
              <td>${t.note || '-'}</td>
              <td class="${t.category_type?.toLowerCase()}">
                ${t.category_type === 'INCOME' ? '+' : '-'}$${parseFloat(t.amount).toFixed(2)}
              </td>
            </tr>
          `).join('')}
        </tbody>
      </table>
    </body>
    </html>
  `;

  // Open in new window for printing
  const printWindow = window.open('', '_blank');
  if (printWindow) {
    printWindow.document.write(htmlContent);
    printWindow.document.close();
    printWindow.print();
  }
};