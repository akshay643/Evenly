// src/utils/minimizeTransactions.js

/**
 * Calculate net balance for every member.
 *
 * NOW HANDLES:
 *   - Equal splits (splitBetween array, no splitAmounts)
 *   - Unequal splits (splitAmounts: { uid: amount })
 *   - Percentage splits (pre-calculated into splitAmounts)
 *   - Share-based splits (pre-calculated into splitAmounts)
 */
export function calcNetBalances(expenses, settlements, memberIds) {
  const net = {};
  memberIds.forEach((id) => {
    net[id] = 0;
  });

  expenses.forEach(
    ({ paidBy, amount, splitBetween, splitAmounts, splitMethod }) => {
      if (!paidBy || !amount || !splitBetween || splitBetween.length === 0)
        return;

      const validSplit = splitBetween.filter((mid) => memberIds.includes(mid));
      if (validSplit.length === 0) return;

      // Credit the payer
      if (net[paidBy] !== undefined) {
        net[paidBy] += amount;
      }

      // Debit each participant their share
      if (splitAmounts && splitMethod && splitMethod !== "equal") {
        // ── Unequal split: use stored per-person amounts ──
        validSplit.forEach((mid) => {
          if (net[mid] !== undefined) {
            const personAmount = splitAmounts[mid] || 0;
            net[mid] -= personAmount;
          }
        });
      } else {
        // ── Equal split (default) ──
        const share = amount / validSplit.length;
        validSplit.forEach((mid) => {
          if (net[mid] !== undefined) {
            net[mid] -= share;
          }
        });
      }
    },
  );

  // Settlements reduce the debtor's debt and the creditor's credit
  settlements.forEach(({ from, to, amount }) => {
    if (!from || !to || !amount) return;
    if (net[from] !== undefined) net[from] += amount;
    if (net[to] !== undefined) net[to] -= amount;
  });

  return net;
}

/**
 * Greedy algorithm to minimise the number of transactions.
 * Works exactly like Splitwise's "simplify debts".
 *
 * Handles both equal and unequal splits correctly.
 */
export function minimizeTransactions(expenses, settlements, memberIds) {
  const net = calcNetBalances(expenses, settlements, memberIds);

  const EPSILON = 0.01;

  const debtors = [];
  const creditors = [];

  Object.entries(net).forEach(([id, bal]) => {
    if (bal < -EPSILON) debtors.push({ id, amount: Math.abs(bal) });
    if (bal > EPSILON) creditors.push({ id, amount: bal });
  });

  debtors.sort((a, b) => b.amount - a.amount);
  creditors.sort((a, b) => b.amount - a.amount);

  const transactions = [];
  let di = 0;
  let ci = 0;

  while (di < debtors.length && ci < creditors.length) {
    const d = debtors[di];
    const c = creditors[ci];
    const settle = Math.min(d.amount, c.amount);

    if (settle > EPSILON) {
      transactions.push({
        from: d.id,
        to: c.id,
        amount: parseFloat(settle.toFixed(2)),
      });
    }

    d.amount -= settle;
    c.amount -= settle;

    if (d.amount < EPSILON) di++;
    if (c.amount < EPSILON) ci++;
  }

  return transactions;
}
