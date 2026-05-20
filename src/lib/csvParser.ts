import Papa from 'papaparse';
import { Transaction } from '../types';

export const parseBankCSV = (fileContent: string, userId: string, fileName?: string): Transaction[] => {
  const results = Papa.parse(fileContent, {
    header: true,
    skipEmptyLines: true,
  });

  const rows = results.data as any[];

  // Extracted account number and name
  let accountNumber = '';
  let accountName = '';

  // 1. Prioritize extracting account number from the beginning of the filename
  if (fileName) {
    const filenameMatch = fileName.trim().match(/^(EE\d{18})/i) || fileName.trim().match(/^(EE[A-Z0-9]{14,26})/i);
    if (filenameMatch) {
      accountNumber = filenameMatch[1].toUpperCase();
      accountName = accountNumber; // Take the account number from the beginning of the filename as the account name
    }
  }

  // 2. If not found from filename, try to pull from row type '10' (standard Estonian Banking standard Swedbank / LHV)
  if (!accountNumber) {
    const accountInfoRow = rows.find(r => {
      const rt = r['Rea tüüp'] || r['Rea tyyp'] || r['Row type'] || r['Type'] || r['Reatüüp'];
      return rt === '10' || String(rt).trim() === '10';
    });

    if (accountInfoRow) {
      accountNumber = String(accountInfoRow['Konto'] || accountInfoRow['Arvelduskonto'] || accountInfoRow['Account'] || '').trim();
      accountName = String(
        accountInfoRow['Saaja/Maksja'] || 
        accountInfoRow['Saaja/maksja'] || 
        accountInfoRow['Nimi'] || 
        accountInfoRow['Name'] || 
        accountInfoRow['Saaja/Maksja nimi'] || 
        accountInfoRow['Saaja/maksja nimi'] || 
        accountInfoRow['Maksja nimi'] || 
        ''
      ).trim();
    }
  }

  // 3. Fallback: Parse the first 15 lines of raw text looking for an IBAN (e.g., EE...)
  if (!accountNumber) {
    const lines = fileContent.split('\n').map(l => l.trim()).filter(Boolean);
    for (const line of lines.slice(0, 15)) {
      const ibanMatch = line.match(/\b(EE\d{18})\b/i);
      if (ibanMatch) {
        accountNumber = ibanMatch[1].toUpperCase();
        
        // Attempt to extract adjacent customer/holder name
        const cells = line.split(/[;,]/).map(c => c.trim().replace(/^"|"$/g, ''));
        const foundName = cells.find(c => 
          c && 
          c.length > 2 && 
          !c.includes('EE') && 
          isNaN(Number(c)) && 
          !/EUR|USD|Date|Kuupäev|Konto|Selgitus|Arvelduskonto|Balance|Summa|Jääk/i.test(c)
        );
        if (foundName) {
          accountName = foundName;
        }
        break;
      }
    }
  }

  // 4. Dual Fallback: Look for repetitive IBAN values in raw fields of the data rows
  if (!accountNumber) {
    const ibanStats: Record<string, number> = {};
    for (const r of rows.slice(0, 15)) {
      for (const value of Object.values(r)) {
        const valStr = String(value || '').trim();
        if (/^EE\d{18}$/i.test(valStr)) {
          ibanStats[valStr] = (ibanStats[valStr] || 0) + 1;
        }
      }
    }
    let bestIban = '';
    let maxCount = 0;
    for (const [iban, count] of Object.entries(ibanStats)) {
      if (count > maxCount) {
        maxCount = count;
        bestIban = iban;
      }
    }
    if (bestIban) {
      accountNumber = bestIban.toUpperCase();
    }
  }

  // 5. Set final fallback names
  if (!accountName && accountNumber) {
    const lastFour = accountNumber.substring(accountNumber.length - 4);
    accountName = `Konto (...${lastFour})`;
  }

  if (!accountNumber) {
    accountNumber = 'EE-PÕHIKONTO';
    accountName = 'Peamine konto';
  }

  return rows.map((row, index): Transaction | null => {
    // Exclude metadata rows (e.g. Swedbank/LHV 10 = Account info, 86 = Balance)
    const rt = row['Rea tüüp'] || row['Rea tyyp'] || row['Row type'] || row['Type'] || row['Reatüüp'];
    if (rt === '10' || rt === '86' || String(rt).trim() === '10' || String(rt).trim() === '86') {
      return null;
    }

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
      rawLine: JSON.stringify(row),
      accountNumber,
      accountName
    };
  }).filter((t): t is Transaction => t !== null && !!t.date && !isNaN(t.amount));
};

