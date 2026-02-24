// src/utils/exportData.js
import * as FileSystem from 'expo-file-system';
import * as Sharing from 'expo-sharing';

/**
 * Generate CSV export of group expenses
 */
export async function exportGroupExpensesCSV(groupName, expenses, membersMap, settlements, currencySymbol) {
  // CSV Header
  let csv = 'Date,Description,Category,Paid By,Amount,Split Between,Per Person Share\n';

  expenses.forEach((exp) => {
    const date = exp.createdAt?.toDate
      ? exp.createdAt.toDate().toISOString().split('T')[0]
      : new Date(exp.createdAt || 0).toISOString().split('T')[0];

    const paidBy = membersMap[exp.paidBy]?.name || membersMap[exp.paidBy]?.email || 'Unknown';
    const splitNames = (exp.splitBetween || [])
      .map((uid) => membersMap[uid]?.name || membersMap[uid]?.email || 'Unknown')
      .join('; ');
    const perPerson = exp.amount / (exp.splitBetween?.length || 1);

    // Escape commas in description
    const desc = `"${(exp.description || '').replace(/"/g, '""')}"`;

    csv += `${date},${desc},${exp.category || 'other'},${paidBy},${exp.amount.toFixed(2)},"${splitNames}",${perPerson.toFixed(2)}\n`;
  });

  // Summary section
  csv += '\n\nSETTLEMENT SUMMARY\n';
  csv += 'From,To,Amount\n';
  settlements.forEach((s) => {
    const from = membersMap[s.from]?.name || 'Unknown';
    const to = membersMap[s.to]?.name || 'Unknown';
    csv += `${from},${to},${s.amount.toFixed(2)}\n`;
  });

  // Balance summary
  csv += '\n\nBALANCE SUMMARY\n';
  csv += 'Member,Total Paid,Total Share,Net Balance\n';

  const net = {};
  Object.keys(membersMap).forEach((uid) => {
    let paid = 0, share = 0;
    expenses.forEach((exp) => {
      if (exp.paidBy === uid) paid += exp.amount;
      if (exp.splitBetween?.includes(uid)) share += exp.amount / exp.splitBetween.length;
    });
    settlements.forEach((s) => {
      if (s.from === uid) { net[uid] = (net[uid] || 0) + s.amount; }
      if (s.to === uid) { net[uid] = (net[uid] || 0) - s.amount; }
    });
    const balance = paid - share + (net[uid] || 0);
    const name = membersMap[uid]?.name || membersMap[uid]?.email || 'Unknown';
    csv += `${name},${paid.toFixed(2)},${share.toFixed(2)},${balance.toFixed(2)}\n`;
  });

  // Write file and share
  const fileName = `${groupName.replace(/[^a-zA-Z0-9]/g, '_')}_expenses_${new Date().toISOString().split('T')[0]}.csv`;
  const filePath = `${FileSystem.documentDirectory}${fileName}`;

  await FileSystem.writeAsStringAsync(filePath, csv, {
    encoding: FileSystem.EncodingType.UTF8,
  });

  if (await Sharing.isAvailableAsync()) {
    await Sharing.shareAsync(filePath, {
      mimeType: 'text/csv',
      dialogTitle: `Export: ${groupName}`,
    });
  }

  return filePath;
}

/**
 * Generate spending analytics
 */
export function generateAnalytics(expenses, userId) {
  const byCategory = {};
  const byMonth = {};
  const byMember = {};
  let totalSpent = 0;
  let totalOwed = 0;

  expenses.forEach((exp) => {
    const cat = exp.category || 'other';
    byCategory[cat] = (byCategory[cat] || 0) + exp.amount;

    const d = exp.createdAt?.toDate ? exp.createdAt.toDate() : new Date(exp.createdAt || 0);
    const monthKey = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
    byMonth[monthKey] = (byMonth[monthKey] || 0) + exp.amount;

    if (exp.paidBy) {
      byMember[exp.paidBy] = (byMember[exp.paidBy] || 0) + exp.amount;
    }

    if (exp.splitBetween?.includes(userId)) {
      const share = exp.amount / exp.splitBetween.length;
      totalSpent += share;
      if (exp.paidBy !== userId) totalOwed += share;
    }
  });

  // Sort categories by amount
  const topCategories = Object.entries(byCategory)
    .sort(([, a], [, b]) => b - a)
    .map(([key, amount]) => ({ key, amount }));

  return {
    totalSpent,
    totalOwed,
    byCategory,
    byMonth,
    byMember,
    topCategories,
    expenseCount: expenses.length,
    avgExpense: expenses.length > 0 ? totalSpent / expenses.length : 0,
  };
}