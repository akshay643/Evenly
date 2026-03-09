// src/constants/categories.js

export const EXPENSE_CATEGORIES = [
  { key: 'food', label: 'Food & Drinks', icon: '🍕' },
  { key: 'groceries', label: 'Groceries', icon: '🛒' },
  { key: 'transport', label: 'Transport', icon: '🚗' },
  { key: 'rent', label: 'Rent & Housing', icon: '🏠' },
  { key: 'entertainment', label: 'Entertainment', icon: '🎬' },
  { key: 'shopping', label: 'Shopping', icon: '🛍️' },
  { key: 'travel', label: 'Travel', icon: '✈️' },
  { key: 'medical', label: 'Medical', icon: '💊' },
  { key: 'bills', label: 'Bills & Utilities', icon: '📱' },
  { key: 'education', label: 'Education', icon: '📚' },
  { key: 'sports', label: 'Sports & Fitness', icon: '⚽' },
  { key: 'gifts', label: 'Gifts', icon: '🎁' },
  { key: 'other', label: 'Other', icon: '💰' },
  { key: 'Nashe', label: 'Nashe', icon: '🥂' },
];

/**
 * Auto-detect category from expense description
 */
export function detectCategory(description) {
  if (!description) return 'other';
  const text = description.toLowerCase();

  // Food & Drinks
  if (/pizza|food|lunch|dinner|breakfast|restaurant|cafe|coffee|tea|chai|biryani|burger|snack|swiggy|zomato|domino|mcdonald|kfc|starbuck|juice|ice\s?cream|cake|bakery|dosa|thali|paneer|chicken|noodle|pasta|sandwich|momos/.test(text))
    return 'food';
  if (/sutta/.test(text))
    return 'Nashe';

  // Groceries
  if (/grocery|groceries|vegetables|veggies|fruits|milk|eggs|rice|flour|atta|oil|sugar|salt|supermarket|bigbasket|blinkit|zepto|instamart|dmart|reliance\s?fresh|kirana/.test(text))
    return 'groceries';

  // Transport
  if (/uber|ola|auto|rickshaw|bus|train|metro|petrol|fuel|diesel|parking|toll|cab|taxi|rapido|bike|gas\s?station|cng/.test(text))
    return 'transport';

  // Rent & Housing
  if (/rent|electricity|electric\s?bill|water\s?bill|gas\s?bill|wifi|internet|broadband|maintenance|society|housing|flat|apartment|plumber|electrician|repair|furniture/.test(text))
    return 'rent';

  // Entertainment
  if (/movie|netflix|spotify|hotstar|prime|disney|youtube|game|gaming|concert|show|ticket|theatre|theater|club|party|pub|bar|drinks|beer|wine|alcohol|hookah/.test(text))
    return 'entertainment';

  // Shopping
  if (/shopping|clothes|shirt|shoes|amazon|flipkart|myntra|ajio|mall|dress|jeans|watch|accessories|electronics|phone|laptop|headphone|earphone/.test(text))
    return 'shopping';

  // Travel
  if (/flight|hotel|trip|booking|airbnb|oyo|makemytrip|goibibo|resort|vacation|holiday|travel|luggage|visa|passport|sightseeing|tour/.test(text))
    return 'travel';

  // Medical
  if (/medicine|doctor|hospital|pharmacy|medical|health|clinic|dentist|checkup|test|lab|blood|xray|scan|consultation|apollo|practo|1mg|pharmeasy/.test(text))
    return 'medical';

  // Bills & Utilities
  if (/recharge|bill|subscription|postpaid|prepaid|jio|airtel|vi\b|bsnl|dth|tata\s?sky|insurance|emi|loan/.test(text))
    return 'bills';

  // Education
  if (/book|course|udemy|class|tuition|school|college|exam|fee|stationery|notebook|pen|pencil|library/.test(text))
    return 'education';

  // Sports & Fitness
  if (/gym|fitness|yoga|swimming|cricket|football|badminton|sports|workout|protein|supplement|stadium|ground/.test(text))
    return 'sports';

  // Gifts
  if (/gift|birthday|present|celebration|anniversary|wedding|surprise|donation|charity/.test(text))
    return 'gifts';

  return 'other';
}

/**
 * Get category info by key
 */
export function getCategoryInfo(key) {
  return EXPENSE_CATEGORIES.find(c => c.key === key) || EXPENSE_CATEGORIES[EXPENSE_CATEGORIES.length - 1];
}

/**
 * Get icon for a description (auto-detect shortcut)
 */
export function getExpenseIcon(description, savedCategory) {
  const catKey = savedCategory || detectCategory(description);
  const cat = getCategoryInfo(catKey);
  return cat.icon;
}

/**
 * Get category color for backgrounds
 */
export function getCategoryColor(key) {
  const colors = {
    food: '#F97316',
    groceries: '#22C55E',
    transport: '#3B82F6',
    rent: '#8B5CF6',
    entertainment: '#EC4899',
    shopping: '#F59E0B',
    travel: '#06B6D4',
    medical: '#EF4444',
    bills: '#6366F1',
    education: '#14B8A6',
    sports: '#10B981',
    gifts: '#E11D48',
    nashe: '#6B7280',
    other: '#6B7280',
  };
  return colors[key] || colors.other;
}

export const dummyCategoryBreakdown = [
  {
    key: "food",
    label: "Food & Dining",
    total: 2450,
    color: "#F97316",
    icon: "🍔",
  },
  {
    key: "travel",
    label: "Travel",
    total: 1800,
    color: "#06B6D4",
    icon: "✈️",
  },
  {
    key: "shopping",
    label: "Shopping",
    total: 3200,
    color: "#8B5CF6",
    icon: "🛍️",
  },
  {
    key: "bills",
    label: "Bills",
    total: 2100,
    color: "#EF4444",
    icon: "📄",
  },
];