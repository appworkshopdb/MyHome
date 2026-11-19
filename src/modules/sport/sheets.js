// Meldet das Sport-Sheet bei der Sheet-Registry an
// (core/lib/sheetRegistry.js). Wird von App.jsx beim Start importiert.
import { registerSheet } from '../../core/lib/sheetRegistry';
import SportQuickSheet from './components/SportQuickSheet';

registerSheet('sport.quick', SportQuickSheet);
