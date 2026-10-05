/** What the user sells: only changes wording and starting suggestions, never the math. */

export interface CategoryInfo {
  id: string;
  emoji: string;
  label: string;
  /** Step 2 question, e.g. "How many pieces do you have?" */
  quantityQuestion: string;
  quantityHelp: string;
  /** Default unit for the quantity. */
  defaultUnit: string;
  /** What one item is called when the user doesn't say ("piece", "meal"). */
  itemWord: string;
  /** What one package is called ("pack", "bag", "bottle"). */
  packageWord: string;
  /** Quick-add buttons for other costs. */
  costIdeas: string[];
}

export const CATEGORIES: CategoryInfo[] = [
  { id: "clothing", emoji: "👕", label: "Clothing & Fashion", quantityQuestion: "How many pieces do you have?", quantityHelp: "Count every piece you bought or made, e.g. 20 shirts.", defaultUnit: "pieces", itemWord: "piece", packageWord: "set", costIdeas: ["Shipping", "Packaging", "Tags & labels", "Transport"] },
  { id: "food", emoji: "🍔", label: "Food & Drinks", quantityQuestion: "How many portions can you make?", quantityHelp: "Meals, plates, cups or bottles from this batch. Made a liquid? Choose liters and set the bottle size below.", defaultUnit: "portions", itemWord: "meal", packageWord: "container", costIdeas: ["Containers", "Gas", "Ingredients", "Transport"] },
  { id: "beauty", emoji: "💄", label: "Beauty & Cosmetics", quantityQuestion: "How many products do you have?", quantityHelp: "Count each product you'll sell, e.g. 30 lip glosses.", defaultUnit: "items", itemWord: "product", packageWord: "set", costIdeas: ["Packaging", "Labels", "Shipping", "Transport"] },
  { id: "skincare", emoji: "🧴", label: "Skincare & Haircare", quantityQuestion: "How much did you make, or how many bottles can you fill?", quantityHelp: "Made it in bulk? Choose liters or kilograms, then set the bottle or jar size below.", defaultUnit: "bottles", itemWord: "bottle", packageWord: "bottle", costIdeas: ["Bottles & jars", "Labels", "Ingredients", "Shipping"] },
  { id: "gifts", emoji: "🎁", label: "Gift Baskets & Packages", quantityQuestion: "How many items do you have for your baskets?", quantityHelp: "Count all the items, then say how many go in one basket below.", defaultUnit: "items", itemWord: "item", packageWord: "basket", costIdeas: ["Baskets", "Ribbon & wrap", "Cards", "Delivery"] },
  { id: "reselling", emoji: "🛍️", label: "Reselling", quantityQuestion: "How many items did you buy?", quantityHelp: "Everything in this purchase, e.g. 50 phone cases.", defaultUnit: "items", itemWord: "item", packageWord: "bundle", costIdeas: ["Shipping", "Customs & duty", "Transport", "Packaging"] },
  { id: "handmade", emoji: "🧵", label: "Handmade Products", quantityQuestion: "How many did you make?", quantityHelp: "Everything this batch of materials makes.", defaultUnit: "pieces", itemWord: "piece", packageWord: "set", costIdeas: ["Materials", "Packaging", "Your time", "Transport"] },
  { id: "wholesale", emoji: "📦", label: "Wholesale Items", quantityQuestion: "How many units did you purchase?", quantityHelp: "The total number of units in this order.", defaultUnit: "units", itemWord: "unit", packageWord: "case", costIdeas: ["Shipping", "Customs & duty", "Storage", "Transport"] },
  { id: "baking", emoji: "🧁", label: "Baking", quantityQuestion: "How many pieces did you bake?", quantityHelp: "Cupcakes, slices, loaves… count what this batch makes.", defaultUnit: "pieces", itemWord: "piece", packageWord: "box", costIdeas: ["Ingredients", "Boxes", "Gas & electricity", "Decorations"] },
  { id: "digital", emoji: "💻", label: "Digital Products", quantityQuestion: "How many do you expect to sell?", quantityHelp: "Digital products cost the same however many you sell, so your costs are shared across the sales you expect.", defaultUnit: "units", itemWord: "copy", packageWord: "bundle", costIdeas: ["Software", "Design", "Advertising", "Platform fees"] },
  { id: "services", emoji: "🛠️", label: "Services", quantityQuestion: "How many jobs or sessions is this for?", quantityHelp: "For example 10 appointments this month. Your costs are shared across them.", defaultUnit: "units", itemWord: "session", packageWord: "package", costIdeas: ["Supplies", "Transport", "Equipment", "Advertising"] },
  { id: "other", emoji: "📦", label: "Other", quantityQuestion: "How many do you have?", quantityHelp: "The number of things you'll sell from this purchase.", defaultUnit: "items", itemWord: "item", packageWord: "pack", costIdeas: ["Packaging", "Transport", "Shipping", "Labour"] },
];

export function categoryInfo(id: string): CategoryInfo {
  return CATEGORIES.find((c) => c.id === id) ?? CATEGORIES[CATEGORIES.length - 1];
}

/** "worm" → "worms", "box" → "boxes", "berry" → "berries". */
export function pluralize(word: string, n = 2): string {
  const w = word.trim();
  if (!w || n === 1) return w;
  if (/(s|x|z|ch|sh)$/i.test(w)) return `${w}es`;
  if (/[^aeiou]y$/i.test(w)) return `${w.slice(0, -1)}ies`;
  return `${w}s`;
}
