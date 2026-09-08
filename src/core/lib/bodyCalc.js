// BMI/Grundumsatz/Tagesbedarf-Berechnung (Mifflin-St Jeor).
// Ursprünglich Teil von modules/nutrition/lib/nutrition.js — jetzt hier,
// weil das Ergebnis auf der gemeinsamen Profil-Seite (core/Profile.jsx)
// angezeigt wird und core/ nicht aus modules/* importieren darf.
// Die Formel selbst ist unverändert.

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
  const wMin = +(weight - 2).toFixed(1);
  const wMax = +(23.5 * (height / 100) ** 2).toFixed(1);

  return { bmi, bmiCat, bmr: Math.round(bmrRaw), tdee, target, protein, water, wMin, wMax, fatG, carbG };
}
