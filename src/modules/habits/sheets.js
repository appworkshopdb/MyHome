// Meldet die Sheets der Gewohnheiten bei der Sheet-Registry an
// (core/lib/sheetRegistry.js). Wird von App.jsx beim Start importiert.
import { registerSheet } from '../../core/lib/sheetRegistry';
import HabitQuickSheet from './components/HabitQuickSheet';
import HabitTemplatePicker from './components/HabitTemplatePicker';

registerSheet('habits.quick', HabitQuickSheet);
registerSheet('habits.templates', HabitTemplatePicker);
