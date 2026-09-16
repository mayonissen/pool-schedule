const START_HOUR = 6;
const END_HOUR = 22;
const TOTAL_HOURS = END_HOUR - START_HOUR;

const EVENT_STYLES = {
  'Adult Lap Swim':     { bg: '#dbeafe', border: '#3b82f6', text: '#1e3a5f' },
  'Open Lap Swim':      { bg: '#d1fae5', border: '#10b981', text: '#064e3b' },
  'General Swim':       { bg: '#e0f2e9', border: '#4caf50', text: '#1b5e20' },
  'Family Swim':        { bg: '#fef3c7', border: '#f59e0b', text: '#78350f' },
  'Closed for Cleaning':{ bg: '#f3f4f6', border: '#9ca3af', text: '#6b7280' },
};

const DEFAULT_STYLE = { bg: '#ede9fe', border: '#8b5cf6', text: '#4c1d95' };

let scheduleData = null;
let activeFilter = null;

function getEventStyle(name) {
  return EVENT_STYLES[name] || DEFAULT_STYLE;
}

function minutesFromStart(hours, minutes) {
  return (hours - START_HOUR) * 60 + minutes;
}

function formatTimeShort(h, m) {
  const period = h >= 12 ? 'p' : 'a';
  const displayH = h > 12 ? h - 12 : (h === 0 ? 12 : h);
  return `${displayH}:${String(m).padStart(2, '0')}${period}`;
}

function renderCalendar(data) {
  const headerEl = document.getElementById('day-headers');
  const timeCol = document.getElementById('time-column');
  const daysContainer = document.getElementById('days-container');

  headerEl.innerHTML = '';
  timeCol.innerHTML = '';
  daysContainer.innerHTML = '';

  const today = new Date().toISOString().slice(0, 10);

  for (let h = START_HOUR; h < END_HOUR; h++) {
    const label = document.createElement('div');
    label.className = 'time-label';
    timeCol.appendChild(label);
  }

  const hourHeight = parseInt(getComputedStyle(document.documentElement)
    .getPropertyValue('--hour-height'));

  data.days.forEach(day => {
    const hdr = document.createElement('div');
    hdr.className = 'day-header' + (day.fullDate === today ? ' today' : '');
    hdr.innerHTML = `<span class="day-name">${day.dayName}</span><span class="day-date">${day.date}</span>`;
    headerEl.appendChild(hdr);

    const col = document.createElement('div');
    col.className = 'day-column';
    if (day.fullDate === today) col.classList.add('today');
    if (day.events.length === 0 && day.notices.some(n =>
      n.text.toLowerCase().includes('closed') || n.text.toLowerCase().includes('no programs')
    )) {
      col.classList.add('closed-day');
    }
    col.style.height = `${TOTAL_HOURS * hourHeight}px`;

    if (day.notices.length > 0) {
      const closedNotice = day.notices.find(n =>
        n.title && !n.text.toLowerCase().includes('no programs at this pool'));
      if (closedNotice) {
        const noticeEl = document.createElement('div');
        noticeEl.className = 'day-notice';
        noticeEl.textContent = closedNotice.title;
        col.appendChild(noticeEl);
      }
    }

    day.events.forEach(ev => {
      const topMin = minutesFromStart(ev.startHour, ev.startMinute);
      const endMin = minutesFromStart(ev.endHour, ev.endMinute);
      const duration = endMin - topMin;

      if (topMin < 0 || duration <= 0) return;

      const topPx = (topMin / 60) * hourHeight;
      const heightPx = (duration / 60) * hourHeight;

      const style = getEventStyle(ev.name);
      const el = document.createElement('div');
      el.className = 'event';
      el.dataset.eventType = ev.name;
      el.style.top = `${topPx}px`;
      el.style.height = `${heightPx}px`;
      el.style.backgroundColor = style.bg;
      el.style.borderColor = style.border;
      el.style.color = style.text;

      const nameSpan = document.createElement('span');
      nameSpan.className = 'event-name';
      nameSpan.textContent = ev.name;
      el.appendChild(nameSpan);

      if (heightPx > 30) {
        const timeSpan = document.createElement('span');
        timeSpan.className = 'event-time';
        timeSpan.textContent = `${formatTimeShort(ev.startHour, ev.startMinute)}–${formatTimeShort(ev.endHour, ev.endMinute)}`;
        el.appendChild(timeSpan);
      }

      el.addEventListener('click', () => setFilter(ev.name));
      col.appendChild(el);
    });

    daysContainer.appendChild(col);
  });

  addStartLines(data, hourHeight, null);
  updateTimeLabels(hourHeight, null);
}

function renderNoticeFlag(notices) {
  const flag = document.getElementById('notice-flag');
  if (notices && notices.length > 0) {
    flag.hidden = false;
  }
}

function addStartLines(data, hourHeight, filter) {
  const container = document.getElementById('days-container');
  container.querySelectorAll('.start-line').forEach(el => el.remove());

  const startMinutes = new Set();
  data.days.forEach(day => {
    day.events.forEach(ev => {
      if (filter && ev.name !== filter) return;
      const min = minutesFromStart(ev.startHour, ev.startMinute);
      if (min >= 0) startMinutes.add(min);
    });
  });

  startMinutes.forEach(min => {
    const topPx = (min / 60) * hourHeight;
    const line = document.createElement('div');
    line.className = 'start-line';
    line.style.top = `${topPx}px`;
    container.appendChild(line);
  });
}

function updateTimeLabels(hourHeight, filter) {
  const timeCol = document.getElementById('time-column');
  timeCol.querySelectorAll('.dynamic-time-label').forEach(el => el.remove());
  if (!scheduleData) return;

  const startTimes = new Map();
  scheduleData.days.forEach(day => {
    day.events.forEach(ev => {
      if (filter && ev.name !== filter) return;
      const min = minutesFromStart(ev.startHour, ev.startMinute);
      if (min >= 0 && !startTimes.has(min)) {
        startTimes.set(min, { hours: ev.startHour, minutes: ev.startMinute });
      }
    });
  });

  const sorted = [...startTimes.entries()].sort((a, b) => a[0] - b[0]);
  const minSpacing = 14;
  let lastPx = -Infinity;

  sorted.forEach(([min, time]) => {
    const topPx = (min / 60) * hourHeight;
    if (topPx - lastPx < minSpacing) return;
    const label = document.createElement('div');
    label.className = 'dynamic-time-label';
    label.style.top = `${topPx}px`;
    label.textContent = formatTimeShort(time.hours, time.minutes);
    timeCol.appendChild(label);
    lastPx = topPx;
  });
}

function getHourHeight() {
  return parseInt(getComputedStyle(document.documentElement)
    .getPropertyValue('--hour-height'));
}

function setFilter(eventType) {
  activeFilter = eventType;
  document.getElementById('filter-label').innerHTML =
    `Showing <strong>${eventType}</strong>`;

  document.querySelectorAll('.event').forEach(el => {
    if (el.dataset.eventType === eventType) {
      el.classList.remove('filtered-out');
      el.classList.add('highlighted');
    } else {
      el.classList.add('filtered-out');
      el.classList.remove('highlighted');
    }
  });

  const hh = getHourHeight();
  addStartLines(scheduleData, hh, eventType);
  updateTimeLabels(hh, eventType);
}

function clearFilter() {
  activeFilter = null;
  document.getElementById('filter-label').innerHTML =
    'Showing <strong>All Events</strong>';

  document.querySelectorAll('.event').forEach(el => {
    el.classList.remove('filtered-out', 'highlighted');
  });

  const hh = getHourHeight();
  addStartLines(scheduleData, hh, null);
  updateTimeLabels(hh, null);
}

function getVisibleEvents() {
  if (!scheduleData) return [];
  const events = [];
  scheduleData.days.forEach(day => {
    day.events.forEach(ev => {
      if (activeFilter && ev.name !== activeFilter) return;
      events.push({ ...ev, fullDate: day.fullDate, dayName: day.dayName });
    });
  });
  return events;
}

function pad2(n) { return String(n).padStart(2, '0'); }

function generateICS() {
  const events = getVisibleEvents();
  if (events.length === 0) return;

  const lines = [
    'BEGIN:VCALENDAR',
    'VERSION:2.0',
    'PRODID:-//Pool Schedule Tool//EN',
    'CALSCALE:GREGORIAN',
    'X-WR-CALNAME:Pool Schedule',
    'X-WR-TIMEZONE:America/New_York',
    'BEGIN:VTIMEZONE',
    'TZID:America/New_York',
    'BEGIN:DAYLIGHT',
    'TZOFFSETFROM:-0500',
    'TZOFFSETTO:-0400',
    'DTSTART:19700308T020000',
    'RRULE:FREQ=YEARLY;BYMONTH=3;BYDAY=2SU',
    'TZNAME:EDT',
    'END:DAYLIGHT',
    'BEGIN:STANDARD',
    'TZOFFSETFROM:-0400',
    'TZOFFSETTO:-0500',
    'DTSTART:19701101T020000',
    'RRULE:FREQ=YEARLY;BYMONTH=11;BYDAY=1SU',
    'TZNAME:EST',
    'END:STANDARD',
    'END:VTIMEZONE',
  ];

  events.forEach((ev, i) => {
    if (!ev.fullDate) return;
    const [y, m, d] = ev.fullDate.split('-');
    const dtStart = `${y}${m}${d}T${pad2(ev.startHour)}${pad2(ev.startMinute)}00`;
    const dtEnd = `${y}${m}${d}T${pad2(ev.endHour)}${pad2(ev.endMinute)}00`;

    lines.push('BEGIN:VEVENT');
    lines.push(`DTSTART;TZID=America/New_York:${dtStart}`);
    lines.push(`DTEND;TZID=America/New_York:${dtEnd}`);
    lines.push(`SUMMARY:${ev.name}`);
    if (ev.room) lines.push(`LOCATION:${ev.room}`);
    lines.push(`UID:pool-${ev.fullDate}-${i}@schedule`);
    lines.push('END:VEVENT');
  });

  lines.push('END:VCALENDAR');

  const blob = new Blob([lines.join('\r\n')], { type: 'text/calendar;charset=utf-8' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  const label = activeFilter ? activeFilter.toLowerCase().replace(/\s+/g, '-') : 'all';
  a.download = `pool-schedule-${label}.ics`;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
}

document.getElementById('btn-pdf').addEventListener('click', () => window.print());
document.getElementById('btn-ics').addEventListener('click', generateICS);
document.getElementById('btn-reset').addEventListener('click', (e) => {
  e.preventDefault();
  clearFilter();
});

async function init() {
  try {
    const resp = await fetch('/api/schedule');
    if (!resp.ok) throw new Error('Failed to load schedule');
    scheduleData = await resp.json();

    if (scheduleData.error) throw new Error(scheduleData.error);

    document.getElementById('loading').hidden = true;
    document.getElementById('calendar').hidden = false;

    if (scheduleData.centerName) {
      document.getElementById('center-name').textContent =
        scheduleData.centerName + ' — Pool Schedule';
      document.title = scheduleData.centerName + ' — Pool Schedule';
    }

    renderNoticeFlag(scheduleData.notices || []);
    renderCalendar(scheduleData);
  } catch (err) {
    document.getElementById('loading').hidden = true;
    const errorEl = document.getElementById('error');
    errorEl.hidden = false;
    errorEl.textContent = `Could not load schedule: ${err.message}`;
  }
}

init();
