// modules/shopping/lib/data/items.js
// Artikel-Daten der Einkaufsliste: Kategorie-Zuordnung, Vorschläge beim Tippen,
// Läden und Einheiten. Gemeinsam genutzt von ItemsView.jsx (Liste) und dem
// Einkaufs-Wizard (core/components/ShoppingQuickSheet.jsx), damit beide Stellen
// dieselben Werte kennen.

// ─── Kategorie-Zuordnung ──────────────────────────────────────────────
export const CATEGORY_MAP = {
  'Äpfel': 'Obst & Gemüse', 'Apfel': 'Obst & Gemüse', 'Bananen': 'Obst & Gemüse',
  'Banane': 'Obst & Gemüse', 'Orangen': 'Obst & Gemüse', 'Orange': 'Obst & Gemüse',
  'Zitronen': 'Obst & Gemüse', 'Zitrone': 'Obst & Gemüse', 'Erdbeeren': 'Obst & Gemüse',
  'Trauben': 'Obst & Gemüse', 'Weintrauben': 'Obst & Gemüse', 'Tomaten': 'Obst & Gemüse',
  'Tomate': 'Obst & Gemüse', 'Gurke': 'Obst & Gemüse', 'Gurken': 'Obst & Gemüse',
  'Paprika': 'Obst & Gemüse', 'Zwiebeln': 'Obst & Gemüse', 'Zwiebel': 'Obst & Gemüse',
  'Knoblauch': 'Obst & Gemüse', 'Kartoffeln': 'Obst & Gemüse', 'Kartoffel': 'Obst & Gemüse',
  'Möhren': 'Obst & Gemüse', 'Karotten': 'Obst & Gemüse', 'Brokkoli': 'Obst & Gemüse',
  'Blumenkohl': 'Obst & Gemüse', 'Spinat': 'Obst & Gemüse', 'Salat': 'Obst & Gemüse',
  'Kopfsalat': 'Obst & Gemüse', 'Rucola': 'Obst & Gemüse', 'Zucchini': 'Obst & Gemüse',
  'Aubergine': 'Obst & Gemüse', 'Pilze': 'Obst & Gemüse', 'Champignons': 'Obst & Gemüse',
  'Avocado': 'Obst & Gemüse', 'Avocados': 'Obst & Gemüse', 'Ingwer': 'Obst & Gemüse',
  'Lauch': 'Obst & Gemüse', 'Kohl': 'Obst & Gemüse', 'Rotkohl': 'Obst & Gemüse',
  'Weißkohl': 'Obst & Gemüse', 'Erbsen': 'Obst & Gemüse', 'Bohnen': 'Obst & Gemüse',
  'Mais': 'Obst & Gemüse', 'Kürbis': 'Obst & Gemüse', 'Radieschen': 'Obst & Gemüse',
  'Sellerie': 'Obst & Gemüse', 'Petersilie': 'Obst & Gemüse', 'Basilikum': 'Obst & Gemüse',
  'Kräuter': 'Obst & Gemüse', 'Schnittlauch': 'Obst & Gemüse', 'Dill': 'Obst & Gemüse',
  'Minze': 'Obst & Gemüse', 'Kiwi': 'Obst & Gemüse', 'Mango': 'Obst & Gemüse',
  'Ananas': 'Obst & Gemüse', 'Melone': 'Obst & Gemüse', 'Wassermelone': 'Obst & Gemüse',
  'Kirschen': 'Obst & Gemüse', 'Pfirsich': 'Obst & Gemüse', 'Nektarine': 'Obst & Gemüse',
  'Pflaumen': 'Obst & Gemüse', 'Birnen': 'Obst & Gemüse', 'Birne': 'Obst & Gemüse',
  'Milch': 'Milch & Eier', 'Butter': 'Milch & Eier', 'Margarine': 'Milch & Eier',
  'Käse': 'Milch & Eier', 'Gouda': 'Milch & Eier', 'Edamer': 'Milch & Eier',
  'Emmentaler': 'Milch & Eier', 'Mozzarella': 'Milch & Eier', 'Feta': 'Milch & Eier',
  'Quark': 'Milch & Eier', 'Joghurt': 'Milch & Eier', 'Naturjoghurt': 'Milch & Eier',
  'Frischkäse': 'Milch & Eier', 'Sahne': 'Milch & Eier', 'Schlagsahne': 'Milch & Eier',
  'Schmand': 'Milch & Eier', 'Crème fraîche': 'Milch & Eier', 'Eier': 'Milch & Eier',
  'Ei': 'Milch & Eier', 'Hüttenkäse': 'Milch & Eier', 'Skyr': 'Milch & Eier',
  'Kefir': 'Milch & Eier', 'Buttermilch': 'Milch & Eier', 'Kaffeesahne': 'Milch & Eier',
  'Kondensmilch': 'Milch & Eier', 'Parmesan': 'Milch & Eier',
  'Hackfleisch': 'Fleisch & Fisch', 'Hähnchen': 'Fleisch & Fisch',
  'Hähnchenbrustfilet': 'Fleisch & Fisch', 'Hähnchenbrust': 'Fleisch & Fisch',
  'Rindfleisch': 'Fleisch & Fisch', 'Schweinefleisch': 'Fleisch & Fisch',
  'Steak': 'Fleisch & Fisch', 'Schnitzel': 'Fleisch & Fisch',
  'Wurst': 'Fleisch & Fisch', 'Salami': 'Fleisch & Fisch', 'Schinken': 'Fleisch & Fisch',
  'Aufschnitt': 'Fleisch & Fisch', 'Bratwurst': 'Fleisch & Fisch',
  'Würstchen': 'Fleisch & Fisch', 'Lachs': 'Fleisch & Fisch',
  'Lachsfilet': 'Fleisch & Fisch', 'Forelle': 'Fleisch & Fisch',
  'Thunfisch': 'Fleisch & Fisch', 'Garnelen': 'Fleisch & Fisch',
  'Fischstäbchen': 'Fleisch & Fisch', 'Speck': 'Fleisch & Fisch',
  'Bacon': 'Fleisch & Fisch', 'Putenbrust': 'Fleisch & Fisch',
  'Brot': 'Brot & Backwaren', 'Brötchen': 'Brot & Backwaren',
  'Vollkornbrot': 'Brot & Backwaren', 'Toastbrot': 'Brot & Backwaren',
  'Toast': 'Brot & Backwaren', 'Croissant': 'Brot & Backwaren',
  'Croissants': 'Brot & Backwaren', 'Laugenstange': 'Brot & Backwaren',
  'Baguette': 'Brot & Backwaren', 'Ciabatta': 'Brot & Backwaren',
  'Mehl': 'Brot & Backwaren', 'Hefe': 'Brot & Backwaren',
  'Backpulver': 'Brot & Backwaren', 'Kuchen': 'Brot & Backwaren',
  'Tiefkühlpizza': 'Tiefkühl', 'Pizza': 'Tiefkühl', 'Pommes': 'Tiefkühl',
  'Tiefkühlgemüse': 'Tiefkühl', 'Tiefkühlerbsen': 'Tiefkühl',
  'Gefrorenes': 'Tiefkühl', 'Eis': 'Tiefkühl', 'Eiswürfel': 'Tiefkühl',
  'Fischfilet': 'Tiefkühl',
  'Wasser': 'Getränke', 'Mineralwasser': 'Getränke', 'Sprudel': 'Getränke',
  'Saft': 'Getränke', 'Orangensaft': 'Getränke', 'Apfelsaft': 'Getränke',
  'Cola': 'Getränke', 'Limonade': 'Getränke', 'Limo': 'Getränke',
  'Bier': 'Getränke', 'Wein': 'Getränke', 'Rotwein': 'Getränke',
  'Weißwein': 'Getränke', 'Sekt': 'Getränke', 'Kaffee': 'Getränke',
  'Tee': 'Getränke', 'Kakao': 'Getränke', 'Eistee': 'Getränke',
  'Energydrink': 'Getränke', 'Smoothie': 'Getränke',
  'Nudeln': 'Nudeln & Reis', 'Spaghetti': 'Nudeln & Reis', 'Penne': 'Nudeln & Reis',
  'Rigatoni': 'Nudeln & Reis', 'Fusilli': 'Nudeln & Reis', 'Reis': 'Nudeln & Reis',
  'Basmati': 'Nudeln & Reis', 'Jasminreis': 'Nudeln & Reis', 'Quinoa': 'Nudeln & Reis',
  'Couscous': 'Nudeln & Reis', 'Bulgur': 'Nudeln & Reis', 'Linsen': 'Nudeln & Reis',
  'Kichererbsen': 'Nudeln & Reis', 'Haferflocken': 'Nudeln & Reis',
  'Müsli': 'Nudeln & Reis', 'Grieß': 'Nudeln & Reis',
  'Tomaten (Dose)': 'Vorrat', 'Dosentomaten': 'Vorrat', 'Tomatensauce': 'Vorrat',
  'Passata': 'Vorrat', 'Tomatenmark': 'Vorrat', 'Brühe': 'Vorrat',
  'Gemüsebrühe': 'Vorrat', 'Hühnerbrühe': 'Vorrat', 'Rinderbrühe': 'Vorrat',
  'Dosensuppe': 'Vorrat', 'Bohnen (Dose)': 'Vorrat', 'Mais (Dose)': 'Vorrat',
  'Thunfisch (Dose)': 'Vorrat', 'Sardinen': 'Vorrat', 'Öl': 'Vorrat',
  'Olivenöl': 'Vorrat', 'Sonnenblumenöl': 'Vorrat', 'Essig': 'Vorrat',
  'Salz': 'Vorrat', 'Pfeffer': 'Vorrat', 'Zucker': 'Vorrat',
  'Honig': 'Vorrat', 'Marmelade': 'Vorrat', 'Nutella': 'Vorrat',
  'Erdnussbutter': 'Vorrat', 'Senf': 'Vorrat', 'Ketchup': 'Vorrat',
  'Mayonnaise': 'Vorrat', 'Mayo': 'Vorrat', 'Sojasoße': 'Vorrat',
  'Sojasauce': 'Vorrat', 'Currypaste': 'Vorrat', 'Kokosmilch': 'Vorrat',
  'Gewürze': 'Vorrat', 'Zimt': 'Vorrat', 'Paprikapulver': 'Vorrat',
  'Oregano': 'Vorrat', 'Thymian': 'Vorrat', 'Rosmarin': 'Vorrat',
  'Schokolade': 'Snacks & Süßes', 'Chips': 'Snacks & Süßes',
  'Kekse': 'Snacks & Süßes', 'Gummibärchen': 'Snacks & Süßes',
  'Nüsse': 'Snacks & Süßes', 'Mandeln': 'Snacks & Süßes',
  'Walnüsse': 'Snacks & Süßes', 'Cashews': 'Snacks & Süßes',
  'Popcorn': 'Snacks & Süßes', 'Müsliriegel': 'Snacks & Süßes',
  'Cracker': 'Snacks & Süßes', 'Salzstangen': 'Snacks & Süßes',
  'Bonbons': 'Snacks & Süßes', 'Fruchtgummi': 'Snacks & Süßes',
  'Shampoo': 'Drogerie', 'Duschgel': 'Drogerie', 'Seife': 'Drogerie',
  'Zahnpasta': 'Drogerie', 'Zahnbürste': 'Drogerie', 'Deodorant': 'Drogerie',
  'Rasierer': 'Drogerie', 'Rasierschaum': 'Drogerie', 'Wattepads': 'Drogerie',
  'Taschentücher': 'Drogerie', 'Toilettenpapier': 'Drogerie', 'Küchenrolle': 'Drogerie',
  'Spülmittel': 'Drogerie', 'Waschmittel': 'Drogerie', 'Weichspüler': 'Drogerie',
  'Reinigungsmittel': 'Drogerie', 'Müllbeutel': 'Drogerie', 'Alufolie': 'Drogerie',
  'Frischhaltefolie': 'Drogerie', 'Backpapier': 'Drogerie', 'Windeln': 'Drogerie',
  'Babynahrung': 'Drogerie', 'Waschlappen': 'Drogerie', 'Schwamm': 'Drogerie',
  'Kondome': 'Drogerie', 'Tampons': 'Drogerie', 'Binden': 'Drogerie',
  'Sonnencreme': 'Drogerie', 'Körperlotion': 'Drogerie', 'Feuchttücher': 'Drogerie',
};

export const ALL_SUGGESTIONS = Object.keys(CATEGORY_MAP).sort((a, b) => a.localeCompare(b, 'de'));

export function getCategory(name) {
  if (!name) return 'Sonstiges';
  const exact = CATEGORY_MAP[name.trim()];
  if (exact) return exact;
  const lower = name.toLowerCase();
  const found = Object.entries(CATEGORY_MAP).find(([k]) => k.toLowerCase() === lower);
  return found ? found[1] : 'Sonstiges';
}

export const STORE_NAMES = [
  'Aldi Nord','Aldi Süd','Lidl','Penny','Netto Marken-Discount','Netto (Edeka)','Norma',
  'REWE','Edeka','Tegut','Hit','Kaufland','Globus',
  "Denn's Biomarkt",'Alnatura','Basic',
  'dm','Rossmann','Müller',
  'Wochenmarkt','Metzger','Bäcker','Asia-Shop','Online-Lieferung',
];

// Einheiten für die Mengenangabe (Auswahl neben der Menge)
export const UNIT_OPTIONS = [
  'Stück', 'g', 'kg', 'ml', 'L', 'Packung', 'Karton', 'Kasten',
  'Flasche', 'Dose', 'Becher', 'Bund', 'Zehe', 'Scheibe', 'EL', 'TL',
];
