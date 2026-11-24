import { LegacyButton } from './components/ui/legacy-button';
import { lazy, Suspense, useEffect, useState, type FormEvent } from 'react';
import { api, explain } from './api';
import { showActionFeedback } from './action-feedback';
import { campusMapCenter } from './meetup-campus';
import '../css/meetup-map.css';
import {
  decodeMeetupLocation, encodeMeetupLocation, validMeetupPoint, type MeetupPoint,
} from './meetup-location';

const MeetupMap = lazy(() => import('./meetup-map'));

export type MeetupHandoff = {
  method: string; timeWindow: string; generalLocation: string; status: string;
};

type Props = {
  transactionId?: number;
  inquiryThreadId?: number;
  handoff: MeetupHandoff | null;
  editable: boolean;
  requiresReconfirmation?: boolean;
  unavailableReason?: string;
  compact?: boolean;
  campusName?: string | null;
  onSaved: () => Promise<void>;
};

export function MeetupLocationCard({
  transactionId, inquiryThreadId, handoff, editable,
  requiresReconfirmation = false, unavailableReason, compact = false, campusName, onSaved,
}: Props) {
  const saved = decodeMeetupLocation(handoff?.generalLocation ?? '');
  const [editing, setEditing] = useState(false);
  const [mapOpen, setMapOpen] = useState(false);
  const [place, setPlace] = useState(saved.place);
  const [timeWindow, setTimeWindow] = useState(handoff?.timeWindow ?? '');
  const [point, setPoint] = useState<MeetupPoint | null>(saved.point);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [acknowledgedReset, setAcknowledgedReset] = useState(false);

  useEffect(() => { if (!editable) setEditing(false); }, [editable]);

  useEffect(() => {
    if (editing) return;
    const latest = decodeMeetupLocation(handoff?.generalLocation ?? '');
    setPlace(latest.place);
    setTimeWindow(handoff?.timeWindow ?? '');
    setPoint(latest.point);
  }, [handoff?.generalLocation, handoff?.timeWindow, editing]);

  const save = async (event: FormEvent) => {
    event.preventDefault();
    if (busy || !point || !validMeetupPoint(point) || (requiresReconfirmation && !acknowledgedReset)) return;
    setBusy(true); setError('');
    try {
      if (transactionId) {
        await api(`/transactions/${transactionId}/meetup-location`, {
          method: 'PUT',
          body: {
            place: place.trim(), timeWindow: timeWindow.trim(),
            lat: point.lat, lng: point.lng,
            resetConfirmations: requiresReconfirmation && acknowledgedReset,
          },
        });
      } else if (inquiryThreadId) {
        await api(`/inquiries/${inquiryThreadId}/handoff`, {
          method: 'PUT',
          body: {
            method: handoff?.method ?? 'campus_pickup',
            timeWindow: timeWindow.trim(),
            generalLocation: encodeMeetupLocation(place, point),
            status: 'proposed',
          },
        });
      } else throw new Error('This conversation is not ready to share a meetup pin.');
      setEditing(false);
      setAcknowledgedReset(false);
      await onSaved();
      showActionFeedback({
        kind: 'success', title: 'Meetup pin saved',
        message: 'The other student can view the location. Both of you must still confirm the meetup.',
        presentation: 'center',
      });
    } catch (e) {
      const message = explain(e);
      setError(message);
      showActionFeedback({ kind: 'error', title: 'Could not save meetup pin', message });
    } finally { setBusy(false); }
  };

  return <section className={`${compact ? 'floating-meetup-card ' : 'panel '}stack meetup-location-card`} aria-label="Meetup location">
    <div className="stack" style={{ gap: '.35rem' }}>
      <h2>Meetup location</h2>
      <p className="muted" style={{ margin: 0 }}>
        Choose a public meeting spot. Only the buyer and seller can see the saved pin.
      </p>
    </div>
    {handoff ? <div className="meetup-summary">
      <p><strong>{saved.place || 'Location not specified'}</strong></p>
      {handoff.timeWindow && <p className="muted">{handoff.timeWindow}</p>}
      {!saved.point && <p className="muted">No map pin saved yet.</p>}
    </div> : <p className="muted" style={{ margin: 0 }}>No meeting point has been shared.</p>}
    <div className="meetup-actions">
      {saved.point && !editing && <LegacyButton type="button" className="ghost"
        onClick={() => setMapOpen(value => !value)}>{mapOpen ? 'Hide map' : 'View map'}</LegacyButton>}
      {editable && !editing && <LegacyButton type="button" className=""
        onClick={() => { setMapOpen(true); setEditing(true); setAcknowledgedReset(false); setError(''); }}>
        {saved.point ? 'Change meetup pin' : 'Choose meetup pin'}
      </LegacyButton>}
    </div>
    {saved.point && mapOpen && !editing && <Suspense fallback={<p role="status" className="muted">Loading map…</p>}>
      <MeetupMap point={saved.point} campusName={campusName} />
    </Suspense>}
    {editing && <form onSubmit={event => void save(event)}>
      <div className="meetup-fields">
        <label htmlFor="meetup-place">Meeting spot
          <input id="meetup-place" value={place} required minLength={3} maxLength={74}
            placeholder="e.g. Campus main gate" onChange={event => setPlace(event.target.value)} />
        </label>
        <label htmlFor="meetup-time">Agreed day and time
          <input id="meetup-time" value={timeWindow} required minLength={3} maxLength={80}
            placeholder="e.g. Friday, 2:00 PM" onChange={event => setTimeWindow(event.target.value)} />
        </label>
      </div>
      <p className="muted meetup-map-guide">
        {!point && campusMapCenter(campusName) ? `Starting near ${campusName}. ` : ''}
        Move the map, then tap your meeting point to drop a pin.
        You can also use the “Pin map center” button.
      </p>
      <Suspense fallback={<p role="status" className="muted">Loading map…</p>}>
        <MeetupMap point={point} campusName={campusName} onSelect={setPoint} />
      </Suspense>
      <p className="muted meetup-pin-info" role="status">
        {point ? `Pin selected: ${point.lat.toFixed(5)}, ${point.lng.toFixed(5)}`
          : 'No pin selected. Choose a location on the map.'}
      </p>
      {requiresReconfirmation && <label className="meetup-reconfirm">
        <input type="checkbox" checked={acknowledgedReset}
          onChange={event => setAcknowledgedReset(event.target.checked)} />
        <span>Change the agreed meeting point and ask both students to confirm again.</span>
      </label>}
      <div className="meetup-actions">
        <LegacyButton className="" type="submit"
          disabled={busy || !point || !validMeetupPoint(point) || place.trim().length < 3
            || timeWindow.trim().length < 3 || (requiresReconfirmation && !acknowledgedReset)}>
          {busy ? 'Saving…' : 'Save meetup location'}
        </LegacyButton>
        <LegacyButton className="ghost" type="button" disabled={busy}
          onClick={() => { setEditing(false); setError(''); }}>Cancel</LegacyButton>
      </div>
      <p className="muted" style={{ margin: 0 }}>The pin is a proposed meeting point, not proof of an agreed or completed transaction.
        Do not use private home addresses. Map tiles load from third-party map servers.</p>
      {error && <p className="err" role="alert">{error}</p>}
    </form>}
    {!editable && !editing && <p className="muted" style={{ margin: 0 }}>
      {unavailableReason ?? (saved.point
        ? 'This transaction is closed. The saved meetup pin is read-only.'
        : 'No editable meetup is available for this transaction.')}
    </p>}
  </section>;
}
