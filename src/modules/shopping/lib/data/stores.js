// modules/shopping/lib/data/stores.js
// Geteilte Datenquelle für Läden + Tageszeit-Optionen. Wird sowohl von
// ListView.jsx (Bearbeiten bestehender Listen) als auch vom core-weiten
// ShoppingQuickSheet.jsx (globaler FAB, Neuanlage) genutzt — analog zum
// Sport-Muster (modules/sport/lib/data/trainingTypes.js), damit beide
// Stellen garantiert dieselben Werte kennen und nicht auseinanderlaufen.

// Deutsche Supermärkte & Discounter — nach Bekanntheitsgrad geordnet
export const STORES = [
  // Discounter
  { group: 'Discounter',    name: 'Aldi Nord' },
  { group: 'Discounter',    name: 'Aldi Süd' },
  { group: 'Discounter',    name: 'Lidl' },
  { group: 'Discounter',    name: 'Penny' },
  { group: 'Discounter',    name: 'Netto Marken-Discount' },
  { group: 'Discounter',    name: 'Netto (Edeka)' },
  { group: 'Discounter',    name: 'Norma' },
  // Supermärkte
  { group: 'Supermarkt',    name: 'REWE' },
  { group: 'Supermarkt',    name: 'Edeka' },
  { group: 'Supermarkt',    name: 'Tegut' },
  { group: 'Supermarkt',    name: 'Hit' },
  // SB-Warenhäuser
  { group: 'Warenhaus',     name: 'Kaufland' },
  { group: 'Warenhaus',     name: 'Globus' },
  // Bio
  { group: 'Bio',           name: "Denn's Biomarkt" },
  { group: 'Bio',           name: 'Alnatura' },
  { group: 'Bio',           name: 'Basic' },
  // Drogerie
  { group: 'Drogerie',      name: 'dm' },
  { group: 'Drogerie',      name: 'Rossmann' },
  { group: 'Drogerie',      name: 'Müller' },
  // Sonstiges
  { group: 'Sonstiges',     name: 'Wochenmarkt' },
  { group: 'Sonstiges',     name: 'Metzger' },
  { group: 'Sonstiges',     name: 'Bäcker' },
  { group: 'Sonstiges',     name: 'Asia-Shop' },
  { group: 'Sonstiges',     name: 'Online-Lieferung' },
];

// due_time ist KEINE Uhrzeit, sondern eine grobe Tageszeit — steht so
// in der DB (sho_lists.due_time, freitext-artiger Enum-artiger Wert) und
// wird überall (DueBadge, ListView) als einer dieser vier Werte erwartet.
export const DAY_PARTS = [
  { value: 'morgens',      icon: '🌅', label: 'Morgens' },
  { value: 'mittags',      icon: '☀️', label: 'Mittags' },
  { value: 'nachmittags',  icon: '🌤️', label: 'Nachmittags' },
  { value: 'abends',       icon: '🌙', label: 'Abends' },
];
