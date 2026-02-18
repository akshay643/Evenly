/**
 * Splitwise-style optimized settlement engine
 *
 * Logic (your example):
 *
 *   Group Trip: Alice, Bob, Charlie
 *   Expenses:
 *     1. Alice paid ₹100 for hotel  (split 3)
 *     2. Bob   paid ₹200 for food   (split 3)
 *     3. Charlie paid ₹300 for transport (split 3)
 *
 *   Total: ₹600   Per-person share: ₹200
 *
 *   Net balances (paid – share):
 *     Alice:   100 – 200 = –100  (owes ₹100)
 *     Bob:     200 – 200 =    0  (settled)
 *     Charlie: 300 – 200 = +100  (gets back ₹100)
 *
 *   Optimised result → Alice pays Charlie ₹100  ✅
 */

/**
 * Calculate net balance for every member.
 *
 * Positive = the group owes them money (they overpaid).
 * Negative = they owe the group money  (they underpaid).
 *
 * @param {Array} expenses    – [{paidBy, amount, splitBetween}, …]
 * @param {Array} settlements – [{from, to, amount}, …]  (already confirmed)
 * @param {Array} memberIds   – ['uid1', 'uid2', …]
 * @returns {Object} { [uid]: netBalance }
 */
export function calcNetBalances(expenses, settlements, memberIds) {
  const net = {};
  memberIds.forEach((id) => { net[id] = 0; });

  // Each expense: payer gets +amount, every participant gets –share
  expenses.forEach(({ paidBy, amount, splitBetween }) => {
    if (!paidBy || !amount || !splitBetween || splitBetween.length === 0) return;
    const share = amount / splitBetween.length;

    net[paidBy] = (net[paidBy] || 0) + amount;
    splitBetween.forEach((mid) => {
      net[mid] = (net[mid] || 0) - share;
    });
  });

  // Settlements reduce the debtor's debt and the creditor's credit
  settlements.forEach(({ from, to, amount }) => {
    if (!from || !to || !amount) return;
    net[from] = (net[from] || 0) + amount;   // debtor paid → balance goes up
    net[to]   = (net[to]   || 0) - amount;   // creditor received → balance goes down
  });

  return net;
}

/**
 * Greedy algorithm to minimise the number of transactions.
 * Works exactly like Splitwise's "simplify debts".
 *
 * 1. Compute net balance for each person.
 * 2. Separate into debtors (net < 0) and creditors (net > 0).
 * 3. Sort both descending by absolute amount.
 * 4. Match largest debtor → largest creditor, settle the minimum
 *    of the two, advance the one that hits zero.
 *
 * @returns {Array} [{ from, to, amount }, …]  minimal transactions
 */
export function minimizeTransactions(expenses, settlements, memberIds) {
  const net = calcNetBalances(expenses, settlements, memberIds);

  const EPSILON = 0.01;

  // Separate into debtors and creditors
  const debtors   = []; // owe money  (net < 0)
  const creditors = []; // owed money (net > 0)

  Object.entries(net).forEach(([id, bal]) => {
    if (bal < -EPSILON)  debtors.push({ id, amount: Math.abs(bal) });
    if (bal >  EPSILON)  creditors.push({ id, amount: bal });
  });

  // Sort descending so largest amounts settle first → fewer transactions
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
        to:   c.id,
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
