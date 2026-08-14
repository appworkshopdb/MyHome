// Platzhalter, bis Statistiken (Häufigkeit/Woche, Verteilung nach Typ,
// Trends) gebaut sind — siehe Feature-Recherche, Priorität nach Kalender
// und Pläne. Bewusst als eigener kleiner Screen statt core/StubModule,
// weil das ein einzelner Tab innerhalb eines bereits gebauten Moduls
// ist, kein ganzes ungebautes Modul.
export default function AuswertungView() {
  return (
    <div className="page">
      <div className="card">
        <div className="card-title">Auswertung</div>
        <p style={{ color: 'var(--text-secondary)', margin: 0 }}>
          Statistiken zu Häufigkeit, Dauer und Trainingsverteilung folgen als Nächstes.
        </p>
      </div>
    </div>
  );
}
