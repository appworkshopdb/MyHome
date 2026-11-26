// Übersicht aller Bausteine des Redesigns (#/bausteine). Nur im Entwicklungsserver
// (App.jsx lädt sie über import.meta.env.DEV), dient zum Prüfen in Hell, Dunkel und bei 320 px.
import { useState } from 'react';
import ModuleTopBar from './components/ModuleTopBar';
import SheetShell from './components/SheetShell';
import ActionToast from './components/ActionToast';
import Icon, { ICON_NAMES } from './components/Icon';
import { useRoute } from './lib/useRoute';
import { formatMoney, formatUnit, formatEstimate, formatNumber } from './lib/format';
import {
  Button, IconButton, Segmented, FilterChip, StatusChip, Checkbox, Switch,
  TextField, SelectButton, ListGroup, ListRow, EmptyState, ErrorState, SkeletonList,
  SheetHeader, SheetFooter, ConfirmDialog,
} from './components/ui';

export default function Bausteine() {
  const { navigate } = useRoute();
  const [zeit, setZeit] = useState('monat');
  const [status, setStatus] = useState('bezahlt');
  const [chip, setChip] = useState('alle');
  const [checks, setChecks] = useState({ w: true, l: false });
  const [toene, setToene] = useState(true);
  const [name, setName] = useState('Lebensmittel');
  const [sheet, setSheet] = useState(false);
  const [confirm, setConfirm] = useState(false);
  const [toast, setToast] = useState(false);
  const [laden, setLaden] = useState(false);

  function neuLaden() {
    setLaden(true);
    window.setTimeout(() => setLaden(false), 1600);
  }

  return (
    <>
      <ModuleTopBar onBack={() => navigate('')} title="Bausteine" action={{ icon: 'search', label: 'Suchen', onClick: () => {} }} />
      <div className="bs-page with-topbar-space">

        <section className="bs-sec">
          <h2 className="bs-h">Knöpfe</h2>
          <div className="bs-wrap">
            <Button>Speichern</Button>
            <Button variant="secondary">Abbrechen</Button>
            <Button variant="text" iconRight="open">Alle anzeigen</Button>
            <Button variant="danger" icon="trash">Löschen</Button>
            <Button loading>Speichert</Button>
            <Button disabled>Gesperrt</Button>
          </div>
          <div className="bs-wrap">
            <Button size="s" icon="plus">Hinzufügen</Button>
            <Button size="s" variant="secondary">Vorlage</Button>
            <IconButton icon="back" label="Zurück" variant="raised" />
            <IconButton icon="search" label="Suchen" variant="raised" />
            <IconButton icon="more" label="Mehr" />
            <IconButton icon="close" label="Schließen" />
            <IconButton icon="edit" label="Bearbeiten" variant="quiet" />
            <IconButton icon="trash" label="Löschen" variant="danger" />
          </div>
        </section>

        <section className="bs-sec">
          <h2 className="bs-h">Auswahl</h2>
          <Segmented label="Zeitraum" value={zeit} onChange={setZeit} options={[{ value: 'monat', label: 'Monat' }, { value: 'woche', label: 'Woche' }, { value: 'jahr', label: 'Jahr' }]} />
          <Segmented label="Status" value={status} onChange={setStatus} options={[{ value: 'offen', label: 'Offen', status: 'caut' }, { value: 'bezahlt', label: 'Bezahlt', status: 'pos' }]} />
          <div className="bs-wrap">
            {[['alle', 'Alle'], ['offen', 'Offen'], ['fix', 'Fixkosten'], ['var', 'Variabel']].map(([k, l]) => (
              <FilterChip key={k} selected={chip === k} onClick={() => setChip(k)} count={k === 'offen' ? 1 : undefined}>{l}</FilterChip>
            ))}
          </div>
          <div className="bs-wrap">
            <StatusChip tone="pos">Bezahlt</StatusChip>
            <StatusChip tone="caut">Offen</StatusChip>
            <StatusChip tone="crit">Überfällig</StatusChip>
            <StatusChip>Pausiert</StatusChip>
          </div>
          <div className="bs-card">
            <Checkbox checked={checks.w} onChange={(v) => setChecks({ ...checks, w: v })} sub="Jederzeit">Wasser trinken</Checkbox>
            <Checkbox checked={checks.l} onChange={(v) => setChecks({ ...checks, l: v })}>Lesen · 20 Min</Checkbox>
            <Switch checked={toene} onChange={setToene}>Töne</Switch>
          </div>
        </section>

        <section className="bs-sec">
          <h2 className="bs-h">Felder</h2>
          <div className="bs-card bs-stack">
            <TextField label="Name" value={name} onChange={(e) => setName(e.target.value)} />
            <TextField label="Name" placeholder="z. B. Miete" error="Name fehlt" />
            <SelectButton label="Zahlungsart" value="Bank" onClick={() => {}} />
            <SelectButton label="Fällig am" icon="calendar" placeholder="Datum wählen" onClick={() => {}} />
            <TextField label="Notiz" multiline placeholder="Zusatzinfo" />
          </div>
        </section>

        <section className="bs-sec">
          <h2 className="bs-h">Liste</h2>
          <ListGroup>
            <ListRow icon="cart" title="Lebensmittel" sub="Variabel · Bank" value={formatMoney(540.38)} status={{ tone: 'pos', label: 'Bezahlt' }} />
            <ListRow icon="note" title="Handyrechnung" note sub="Fällig heute" value={formatMoney(6.6)} status={{ tone: 'caut', label: 'Offen' }} />
            <ListRow icon="home" title="Fixkosten" sub="4 Posten" value={formatMoney(958.59)} chevron onClick={() => {}} />
            <ListRow icon="repeat" tone="shop" title="Streaming" sub="Monatlich · Karte" value={formatMoney(13.99)} trailing={<IconButton icon="more" label="Mehr zu Streaming" />} />
          </ListGroup>
          <p className="bs-note">{formatUnit(78.4, 'kg')} · {formatEstimate(540, 'kcal')} · {formatNumber(null)} · {formatMoney(-6.6)}</p>
        </section>

        <section className="bs-sec">
          <h2 className="bs-h">Leer, Laden, Fehler</h2>
          <div className="bs-card"><EmptyState title="Noch keine Buchung" action={{ label: 'Hinzufügen', onClick: () => {} }} /></div>
          <div className="bs-card"><ErrorState onRetry={() => {}} /></div>
          {laden ? <SkeletonList rows={3} /> : (
            <ListGroup className="ui-fade-in">
              <ListRow icon="due" title="Strom" sub="Fällig 30.10." value={formatMoney(62)} status={{ tone: 'caut', label: 'Offen' }} />
              <ListRow icon="due" title="Internet" sub="Seit 3 Tagen fällig" value={formatMoney(62.97)} status={{ tone: 'crit', label: 'Überfällig' }} />
            </ListGroup>
          )}
          <Button variant="secondary" size="s" icon="restore" onClick={neuLaden}>Neu laden</Button>
        </section>

        <section className="bs-sec">
          <h2 className="bs-h">Fenster und Rückmeldung</h2>
          <div className="bs-wrap">
            <Button variant="secondary" onClick={() => setSheet(true)}>Fenster öffnen</Button>
            <Button variant="secondary" onClick={() => setConfirm(true)}>Bestätigen</Button>
            <Button variant="secondary" onClick={() => setToast(true)}>Toast</Button>
          </div>
        </section>

        <section className="bs-sec">
          <h2 className="bs-h">Symbole</h2>
          <div className="bs-icons">
            {ICON_NAMES.map((n) => (
              <span key={n} className="bs-icon"><Icon name={n} size={22} /><small>{n}</small></span>
            ))}
          </div>
        </section>
      </div>

      {sheet && (
        <SheetShell onClose={() => setSheet(false)} labelledBy="bs-sheet-title">
          <SheetHeader id="bs-sheet-title" title="Posten" sub="Erfasst am 01.09.2026" onClose={() => setSheet(false)} />
          <div className="bs-sheet-body">
            <ListGroup>
              <ListRow title="Kategorie" value="Variabel" />
              <ListRow title="Zahlungsart" value="Bank" />
            </ListGroup>
          </div>
          <SheetFooter>
            <Button variant="danger" icon="trash" onClick={() => setSheet(false)}>Löschen</Button>
            <Button icon="edit" onClick={() => setSheet(false)}>Bearbeiten</Button>
          </SheetFooter>
        </SheetShell>
      )}
      {confirm && (
        <ConfirmDialog title="Alle Finanzdaten löschen?" text="Das lässt sich nicht rückgängig machen." confirmLabel="Endgültig löschen" onConfirm={() => {}} onClose={() => setConfirm(false)} />
      )}
      {toast && (
        <ActionToast title="Eintrag gelöscht" duration={4000} actions={[{ label: 'Rückgängig', onPress: () => {} }]} onClose={() => setToast(false)} />
      )}
    </>
  );
}
