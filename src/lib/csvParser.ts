import Papa from 'papaparse';
import { Transaction } from '../types';

export const parseBankCSV = (fileContent: string, userId: string): Transaction[] => {
  const results = Papa.parse(fileContent, {
    header: true,
    skipEmptyLines: true,
  });

  const headers = results.meta.fields || [];
  const rows = results.data as any[];

  // Detect bank based on headers
  // LHV typically has "Saaja/Maksja nimi" and "Kuupäev"
  // Swedbank has "Saaja/Maksja" and "Selgitus"
  // SEB has "Date", "Payee", "Amount"
  
  return rows.map((row, index) => {
    // Try to normalize fields
    const date = row['Kuupäev'] || row['Date'] || row['Tehingu kuupäev'];
    const recipient = row['Saaja/Maksja nimi'] || row['Saaja/maksja nimi'] || row['Saaja/Maksja'] || row['Saaja/maksja'] || row['Payee/Payer'] || row['Saaja Name'] || row['Maksja nimi'] || row['Saaja nimi'] || row['Saaja'];
    const amountStr = row['Summa'] || row['Amount'];
    const description = row['Selgitus'] || row['Description'] || row['Tehingu selgitus'];
    const type = row['D/K'] || row['Type']; // D = Debit (Expense), K = Credit (Income) for Swedbank

    let amount = parseFloat(amountStr?.replace(',', '.') || '0');
    
    // Some banks use absolute amount + D/K column
    if (type === 'D' || type === 'S' || type === '-' || (amountStr && amountStr.startsWith('-'))) {
      if (amount > 0) amount = -amount;
    }

    return {
      id: `ext-${Date.now()}-${index}`,
      date: date || '',
      amount: amount,
      recipient: recipient || '',
      description: description || '',
      userId: userId,
      rawLine: JSON.stringify(row)
    };
  }).filter(t => t.date && !isNaN(t.amount));
};
