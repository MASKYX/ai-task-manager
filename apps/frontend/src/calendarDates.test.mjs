import test from 'node:test';
import assert from 'node:assert/strict';
import { eventDayKey, moveEvent, formEventDates, eventInputDate } from './calendarDates.ts';

test('all-day event stays on the date returned by the provider', () => {
    const event = { startDateTime: '2026-09-21', endDateTime: '2026-09-22', allDay: true };
    assert.equal(eventDayKey(event), '2026-09-21');
    const moved = moveEvent(event, new Date(2026, 8, 23));
    assert.equal(moved.startDateTime, '2026-09-23');
    assert.equal(moved.endDateTime, '2026-09-24');
});

test('timed drop preserves the target local day and time', () => {
    const start = new Date(2026, 8, 21, 9, 30);
    const end = new Date(2026, 8, 21, 10, 30);
    const moved = moveEvent({ startDateTime: start.toISOString(), endDateTime: end.toISOString(), allDay: false }, new Date(2026, 8, 23));
    assert.equal(eventInputDate(moved.startDateTime, false), '2026-09-23');
    assert.equal(new Date(moved.startDateTime).getHours(), 9);
    assert.equal(new Date(moved.endDateTime).getHours(), 10);
});

test('all-day form dates use an exclusive end date', () => {
    assert.deepEqual(formEventDates('2026-09-21', '00:00', '2026-09-21', '23:59', true),
        { startDateTime: '2026-09-21', endDateTime: '2026-09-22' });
});
