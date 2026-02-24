// src/utils/expenseCategories.js

export const CATEGORIES = [
  { key: "food", label: "Food & Drink", icon: "🍔", color: "#F59E0B" },
  { key: "transport", label: "Transport", icon: "🚗", color: "#3B82F6" },
  {
    key: "accommodation",
    label: "Accommodation",
    icon: "🏨",
    color: "#8B5CF6",
  },
  { key: "shopping", label: "Shopping", icon: "🛍️", color: "#EC4899" },
  {
    key: "entertainment",
    label: "Entertainment",
    icon: "🎬",
    color: "#EF4444",
  },
  { key: "groceries", label: "Groceries", icon: "🛒", color: "#10B981" },
  { key: "utilities", label: "Utilities", icon: "💡", color: "#6366F1" },
  { key: "rent", label: "Rent", icon: "🏠", color: "#14B8A6" },
  { key: "medical", label: "Medical", icon: "🏥", color: "#DC2626" },
  {
    key: "subscriptions",
    label: "Subscriptions",
    icon: "📱",
    color: "#7C3AED",
  },
  { key: "travel", label: "Travel", icon: "✈️", color: "#0EA5E9" },
  { key: "gifts", label: "Gifts", icon: "🎁", color: "#F97316" },
  { key: "other", label: "Other", icon: "📋", color: "#6B7280" },
];

// Auto-detect category from description
const KEYWORDS = {
  food: [
    "food",
    "lunch",
    "dinner",
    "breakfast",
    "restaurant",
    "pizza",
    "burger",
    "coffee",
    "cafe",
    "tea",
    "snack",
    "biryani",
    "chai",
    "dosa",
    "thali",
    "swiggy",
    "zomato",
    "dominos",
    "mcdonalds",
    "kfc",
    "starbucks",
    "bar",
    "drinks",
    "beer",
    "wine",
  ],
  transport: [
    "uber",
    "ola",
    "taxi",
    "cab",
    "auto",
    "rickshaw",
    "bus",
    "train",
    "metro",
    "fuel",
    "petrol",
    "diesel",
    "gas",
    "parking",
    "toll",
  ],
  accommodation: [
    "hotel",
    "hostel",
    "airbnb",
    "stay",
    "room",
    "resort",
    "lodge",
    "rent",
  ],
  shopping: [
    "shopping",
    "clothes",
    "shoes",
    "amazon",
    "flipkart",
    "myntra",
    "mall",
  ],
  entertainment: [
    "movie",
    "cinema",
    "netflix",
    "spotify",
    "game",
    "concert",
    "show",
    "party",
  ],
  groceries: [
    "grocery",
    "vegetables",
    "fruits",
    "milk",
    "bread",
    "eggs",
    "supermarket",
    "bigbasket",
    "blinkit",
    "zepto",
    "dmart",
  ],
  utilities: [
    "electricity",
    "water",
    "wifi",
    "internet",
    "phone",
    "recharge",
    "bill",
    "gas cylinder",
  ],
  medical: ["medicine", "doctor", "hospital", "pharmacy", "medical", "health"],
  subscriptions: ["subscription", "premium", "plan", "membership"],
  travel: ["flight", "ticket", "booking", "trip", "travel", "visa", "passport"],
  gifts: ["gift", "present", "birthday", "anniversary"],
};

export function detectCategory(description) {
  const lower = description.toLowerCase().trim();

  for (const [category, keywords] of Object.entries(KEYWORDS)) {
    for (const keyword of keywords) {
      if (lower.includes(keyword)) {
        return category;
      }
    }
  }

  return "other";
}

export function getCategoryInfo(key) {
  return (
    CATEGORIES.find((c) => c.key === key) || CATEGORIES[CATEGORIES.length - 1]
  );
}
