// Meldet die Einkaufs-Sheets bei der Sheet-Registry an
// (core/lib/sheetRegistry.js). Wird von App.jsx beim Start importiert.
import { registerSheet } from '../../core/lib/sheetRegistry';
import ShoppingQuickSheet from './components/ShoppingQuickSheet';
import RecipeToShoppingSheet from './components/RecipeToShoppingSheet';

registerSheet('shopping.quick', ShoppingQuickSheet);
registerSheet('shopping.fromRecipe', RecipeToShoppingSheet);
