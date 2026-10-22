import test from "node:test";
import assert from "node:assert/strict";
import {
    addMonths,
    addDaysToKey,
    buildEventInput,
    dayKey,
    daysBetweenKeys,
    eventAgendaDayKey,
    eventDayKeys,
    eventDurationDays,
    eventIntersectsMonth,
    formFromEvent,
    groupEventsByDay,
    isValidDayKey,
    monthGrid,
    monthRange,
    moveEvent,
    sortEvents,
    toInclusiveEndDate,
    validateEventForm,
} from "./calendar.ts";

function allDayEvent(start, end, summary = "Trip") {
    return { id: "event-1", summary, description: "", startDateTime: start, endDateTime: end, allDay: true };
}

function timedEvent(start, end, summary = "Meeting") {
    return {
        id: "event-2",
        summary,
        description: "",
        startDateTime: start.toISOString(),
        endDateTime: end.toISOString(),
        allDay: false,
    };
}

test("month navigation never skips a month", () => {
    const january = new Date(2026, 0, 31, 12);
    assert.deepEqual(
        [addMonths(january, 1).getFullYear(), addMonths(january, 1).getMonth(), addMonths(january, 1).getDate()],
        [2026, 1, 1],
    );
    assert.equal(addMonths(new Date(2026, 11, 15, 12), 1).getFullYear(), 2027);
    assert.equal(addMonths(new Date(2026, 0, 15, 12), -1).getFullYear(), 2025);
});

test("month grid is a stable six-week Monday-first range", () => {
    const cells = monthGrid(new Date(2026, 0, 15, 12));
    assert.equal(cells.length, 42);
    assert.equal(cells[0].date.getDay(), 1);
    assert.equal(dayKey(cells[0].date), "2025-12-29");
    assert.equal(cells[0].inMonth, false);
    assert.equal(cells[3].inMonth, true);
    assert.equal(dayKey(cells[41].date), "2026-02-08");

    const range = monthRange(new Date(2026, 0, 15, 12));
    assert.equal(dayKey(range.start), "2025-12-29");
    assert.equal(daysBetweenKeys(dayKey(range.start), dayKey(range.end)), 42);
});

test("all-day events span every day until the exclusive end", () => {
    const event = allDayEvent("2026-09-21", "2026-09-24");
    assert.deepEqual(eventDayKeys(event), ["2026-09-21", "2026-09-22", "2026-09-23"]);
    assert.equal(eventDurationDays(event), 3);

    const grouped = groupEventsByDay([event]);
    assert.equal(grouped.get("2026-09-22")?.length, 1);
    assert.equal(grouped.get("2026-09-24"), undefined);
});

test("timed events stay on their start day in the grid", () => {
    const event = timedEvent(new Date(2026, 8, 21, 22, 0), new Date(2026, 8, 22, 2, 0));
    assert.deepEqual(eventDayKeys(event), ["2026-09-21"]);
});

test("moving an all-day event preserves its duration", () => {
    const moved = moveEvent(allDayEvent("2026-09-21", "2026-09-24"), new Date(2026, 8, 30, 12));
    assert.equal(moved.allDay, true);
    assert.equal(moved.startDateTime, "2026-09-30");
    assert.equal(moved.endDateTime, "2026-10-03");
});

test("moving a timed event preserves the local wall time", () => {
    const event = timedEvent(new Date(2026, 8, 21, 9, 30), new Date(2026, 8, 21, 10, 30));
    const moved = moveEvent(event, new Date(2026, 8, 23, 12));
    assert.equal(moved.allDay, false);

    const start = new Date(moved.startDateTime);
    const end = new Date(moved.endDateTime);
    assert.equal(start.getDate(), 23);
    assert.equal(start.getHours(), 9);
    assert.equal(start.getMinutes(), 30);
    assert.equal(end.getHours(), 10);
    assert.equal(end.getMinutes(), 30);
});

test("editing an all-day event shows an inclusive end date", () => {
    const form = formFromEvent(allDayEvent("2026-09-21", "2026-09-24"));
    assert.equal(form.startDate, "2026-09-21");
    assert.equal(form.endDate, "2026-09-23");
    assert.equal(toInclusiveEndDate("2026-09-24", true), "2026-09-23");
});

test("building an all-day event uses an exclusive end date", () => {
    const input = buildEventInput({
        summary: "  Trip  ",
        description: "  Coast  ",
        allDay: true,
        startDate: "2026-09-21",
        startTime: "00:00",
        endDate: "2026-09-23",
        endTime: "00:00",
    });

    assert.deepEqual(input, {
        summary: "Trip",
        description: "Coast",
        startDateTime: "2026-09-21",
        endDateTime: "2026-09-24",
        allDay: true,
    });
});

test("form validation matches the backend rules", () => {
    const base = {
        summary: "Meeting",
        description: "",
        allDay: false,
        startDate: "2026-09-21",
        startTime: "09:00",
        endDate: "2026-09-21",
        endTime: "10:00",
    };

    assert.equal(validateEventForm(base), null);
    assert.match(validateEventForm({ ...base, summary: "  " }), /title/i);
    assert.match(validateEventForm({ ...base, endTime: "09:00" }), /after the start/i);
    assert.match(validateEventForm({ ...base, endDate: "2026-09-20" }), /after the start/i);
    assert.match(
        validateEventForm({ ...base, allDay: true, endDate: "2026-09-20" }),
        /on or after/i,
    );
    assert.match(validateEventForm({ ...base, startDate: "2026-02-30" }), /valid start date/i);
    assert.equal(isValidDayKey("2026-02-30"), false);
    assert.equal(isValidDayKey("2026-02-28"), true);
});

test("events sort chronologically with all-day events first within a day", () => {
    const sorted = sortEvents([
        allDayEvent("2026-10-23", "2026-10-26", "Offsite"),
        timedEvent(new Date(2026, 9, 20, 10, 0), new Date(2026, 9, 20, 11, 0), "Planning"),
        timedEvent(new Date(2026, 9, 21, 13, 0), new Date(2026, 9, 21, 15, 0), "Deep work"),
        allDayEvent("2026-10-21", "2026-10-22", "Conference"),
    ]);

    assert.deepEqual(sorted.map((event) => event.summary), [
        "Planning",
        "Conference",
        "Deep work",
        "Offsite",
    ]);
});

test("month membership uses half-open ranges", () => {
    const september = new Date(2026, 8, 15, 12);
    assert.equal(eventIntersectsMonth(allDayEvent("2026-09-01", "2026-10-01"), september), true);
    assert.equal(eventIntersectsMonth(allDayEvent("2026-10-01", "2026-10-02"), september), false);
    assert.equal(eventIntersectsMonth(allDayEvent("2026-08-30", "2026-09-01"), september), false);
    assert.equal(eventIntersectsMonth(allDayEvent("2026-08-30", "2026-09-02"), september), true);
    assert.equal(eventAgendaDayKey(allDayEvent("2026-08-30", "2026-09-02"), september), "2026-09-01");
});

test("date key helpers are local-time safe", () => {
    assert.equal(addDaysToKey("2026-03-28", 2), "2026-03-30");
    assert.equal(addDaysToKey("2026-12-31", 1), "2027-01-01");
    assert.equal(daysBetweenKeys("2026-03-28", "2026-03-30"), 2);
});
