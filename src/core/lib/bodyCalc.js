// BMI/Grundumsatz/Tagesbedarf-Berechnung (Mifflin-St Jeor).
// Ursprünglich Teil von modules/nutrition/lib/nutrition.js — jetzt hier,
// weil das Ergebnis auf der gemeinsamen Profil-Seite (core/Profile.jsx)
// angezeigt wird und core/ nicht aus modules/* importieren darf.
//
// Formeln gegen Fachliteratur geprüft (September 2026):
// - BMI/BMR/Aktivitätsfaktoren/Kalorienziel/Proteinziel: Standardwerte,
//   unverändert korrekt.
// - wMin/wMax ("Idealgewicht-Bereich"): war fehlerhaft (wMin = Gewicht−2,
//   keine echte Formel) und wurde nirgends angezeigt. Jetzt korrekt über
//   BMI-Rückrechnung (18,5–24,9 × Größe²) UND tatsächlich genutzt.

const ACTIVITY_FACTORS = { sitzend: 1.2, leicht: 1.375, moderat: 1.55, aktiv: 1.725, sehrAktiv: 1.9 };
const GOAL_OFFSETS = { abnehmen: -500, zunehmen: 500, muskel: 250, halten: 0 };

export const GOAL_NOTE = { abnehmen: '−500 kcal', zunehmen: '+500 kcal', muskel: '+250 kcal', halten: 'Erhalt' };

export function computeBody(profile) {
  if (!profile.age || !profile.height || !profile.weight) return null;
  const { age, height, weight, gender, activity, goal } = profile;

  const bmi = +(weight / (height / 100) ** 2).toFixed(1);
  const bmiCat = bmi < 18.5 ? 'Untergewicht' : bmi < 25 ? 'Normalgewicht' : bmi < 30 ? 'Übergewicht' : 'Adipositas';

  const bmrRaw = gender === 'm'
    ? 10 * weight + 6.25 * height - 5 * age + 5
    : 10 * weight + 6.25 * height - 5 * age - 161;

  const tdee = Math.round(bmrRaw * (ACTIVITY_FACTORS[activity] || 1.55));
  const target = Math.max(1200, tdee + (GOAL_OFFSETS[goal] || 0));
  const protein = Math.round(weight * (goal === 'muskel' ? 2 : 1.6));
  const water = +(weight * 0.035).toFixed(1);
  const fatG = Math.round((target * 0.3) / 9);
  const carbG = Math.round((target - protein * 4 - fatG * 9) / 4);

  // Idealgewicht-Bereich: BMI 18,5 bis 24,9 zurückgerechnet auf kg
  // (korrigiert — vorher fehlerhafte Platzhalter-Formel, siehe oben)
  const hM = height / 100;
  const wMin = +(18.5 * hM * hM).toFixed(1);
  const wMax = +(24.9 * hM * hM).toFixed(1);

  return { bmi, bmiCat, bmr: Math.round(bmrRaw), tdee, target, protein, water, wMin, wMax, fatG, carbG };
}

// Erklärungstexte fürs antippbare Info-Symbol je Ergebnis-Kachel.
// was = worum geht's, wofuer = wozu dient der Wert, wie = Formel/Herkunft.
export const METRIC_INFO = {
  bmi: {
    title: 'BMI',
    was: 'Body-Mass-Index — das Verhältnis von Gewicht zu Körpergröße.',
    wofuer: 'Grobe, schnelle Einordnung, ob das Gewicht im statistisch üblichen Bereich liegt.',
    wie: 'Gewicht (kg) ÷ Größe (m)². WHO-Kategorien: unter 18,5 Untergewicht, 18,5–25 Normalgewicht, 25–30 Übergewicht, ab 30 Adipositas. Berücksichtigt keinen Muskelanteil — bei sehr muskulösen Menschen wenig aussagekräftig.',
  },
  bmr: {
    title: 'Grundumsatz',
    was: 'Die Kalorien, die dein Körper in völliger Ruhe für lebenswichtige Funktionen braucht (Atmung, Kreislauf, Zellerneuerung).',
    wofuer: 'Der Basiswert, aus dem sich unten der Tagesbedarf ableitet.',
    wie: 'Mifflin-St-Jeor-Formel — laut Vergleichsstudien die genaueste frei verfügbare Schätzformel (bei rund 71% der Menschen innerhalb von 10% des tatsächlich gemessenen Werts). Männer: 10×Gewicht + 6,25×Größe − 5×Alter + 5. Frauen: dieselbe Formel, aber −161 statt +5.',
  },
  tdee: {
    title: 'Tagesbedarf',
    was: 'Geschätzter Gesamtkalorienverbrauch pro Tag, inklusive Bewegung.',
    wofuer: 'Der Referenzwert, bei dem dein Gewicht stabil bleiben würde ("Erhaltungskalorien").',
    wie: 'Grundumsatz × Aktivitätsfaktor (1,2 bei sitzend bis 1,9 bei sehr aktiv). Die größte Fehlerquelle ist meist eine zu hoch eingeschätzte Aktivität — im Zweifel eine Stufe niedriger wählen.',
  },
  target: {
    title: 'Kalorienziel',
    was: 'Die empfohlene Kalorienzufuhr für dein gewähltes Ziel.',
    wofuer: 'Der tatsächliche Zielwert für die Ernährung — nicht nur der reine Erhaltungsbedarf.',
    wie: 'Tagesbedarf ± Offset je Ziel: Abnehmen −500, Zunehmen +500, Muskelaufbau +250, Halten ±0 kcal. 500 kcal Defizit/Überschuss entsprechen grob 0,5 kg Körpergewicht pro Woche. Nach unten auf 1.200 kcal begrenzt (Sicherheitsuntergrenze).',
  },
  protein: {
    title: 'Proteinziel',
    was: 'Empfohlene tägliche Eiweißmenge.',
    wofuer: 'Wichtig für Muskelerhalt (besonders im Kaloriendefizit) und Muskelaufbau.',
    wie: '1,6 g pro kg Körpergewicht (Halten/Abnehmen/Zunehmen), 2,0 g/kg bei Muskelaufbau. Orientiert an der Sporternährungs-Fachgesellschaft ISSN (empfohlener Bereich: 1,4–2,0 g/kg) — deutlich über der DGE-Minimalempfehlung von 0,8 g/kg für die Allgemeinbevölkerung, die auf reine Bedarfsdeckung ohne Trainingsziel zielt.',
  },
  fat: {
    title: 'Fettziel',
    was: 'Empfohlene tägliche Fettmenge in Gramm.',
    wofuer: 'Ein Baustein der Aufteilung des Kalorienziels auf die drei Makronährstoffe.',
    wie: '30% des Kalorienziels, umgerechnet mit 9 kcal pro Gramm Fett — liegt innerhalb der gängigen Fettspanne von 20–35% der Gesamtenergie.',
  },
  carb: {
    title: 'Kohlenhydratziel',
    was: 'Empfohlene tägliche Kohlenhydratmenge in Gramm.',
    wofuer: 'Der nach Protein und Fett verbleibende Rest des Kalorienziels.',
    wie: '(Kalorienziel − Protein×4 − Fett×9) ÷ 4 kcal pro Gramm Kohlenhydrate.',
  },
  water: {
    title: 'Wasserbedarf',
    was: 'Grobe Richtgröße für die tägliche Flüssigkeitszufuhr.',
    wofuer: 'Orientierungswert — ergänzt das Trinken nach Durstgefühl, ersetzt es aber nicht.',
    wie: '35 ml pro kg Körpergewicht — gängiger Faustwert (übliche Spanne 30–35 ml/kg). Bei Hitze, Sport oder Fieber steigt der Bedarf zusätzlich.',
  },
  idealweight: {
    title: 'Idealgewicht-Bereich',
    was: 'Gewichtsspanne, die laut BMI als "Normalgewicht" gilt.',
    wofuer: 'Orientierung, in welchem Gewichtsbereich dein BMI zwischen 18,5 und 24,9 läge.',
    wie: '18,5 × Größe(m)² bis 24,9 × Größe(m)². Reine BMI-Rückrechnung — berücksichtigt keine individuelle Körperzusammensetzung (Muskelanteil, Statur).',
  },
};
