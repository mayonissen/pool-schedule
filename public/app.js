const POOLS = [
  { borough: 'Bronx', code: 'X045', name: "St. Mary's Recreation Center" },
  { borough: 'Brooklyn', code: 'B270', name: 'Brownsville Recreation Center' },
  { borough: 'Brooklyn', code: 'B085', name: 'Metropolitan Recreation Center' },
  { borough: 'Brooklyn', code: 'B250', name: 'Shirley Chisholm Recreation Center' },
  { borough: 'Brooklyn', code: 'B245', name: "St. John's Recreation Center" },
  { borough: 'Manhattan', code: 'M164', name: 'Asser Levy Recreation Center' },
  { borough: 'Manhattan', code: 'M260', name: 'Chelsea Recreation Center' },
  { borough: 'Manhattan', code: 'M130', name: 'Constance Baker Motley Recreation Center' },
  { borough: 'Manhattan', code: 'M063', name: 'Gertrude Ederle Recreation Center' },
  { borough: 'Manhattan', code: 'M131', name: 'Hansborough Recreation Center' },
  { borough: 'Manhattan', code: 'M103', name: 'Tony Dapolito Recreation Center' },
  { borough: 'Queens', code: 'Q099', name: 'Flushing Meadows Corona Park Aquatics Center & Ice Rink' },
  { borough: 'Queens', code: 'Q448', name: 'Roy Wilkins Recreation Center' },
];

const START_HOUR = 6;
const END_HOUR = 22;
const TOTAL_HOURS = END_HOUR - START_HOUR;

const CLOSED_NAMES = ['Closed for Cleaning', 'Pool closed for cleaning'];
function isClosed(name) { return CLOSED_NAMES.some(n => n.toLowerCase() === name.toLowerCase()); }

let scheduleData = null;
let activeFilter = null;

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

      const el = document.createElement('div');
      el.className = 'event';
      if (isClosed(ev.name)) el.classList.add('event-closed');
      el.dataset.eventType = ev.name;
      el.style.top = `${topPx}px`;
      el.style.height = `${heightPx}px`;

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

      if (!isClosed(ev.name)) {
        el.addEventListener('click', () => setFilter(ev.name));
        el.addEventListener('mouseenter', () => {
          document.querySelectorAll('.event:not(.event-closed)').forEach(m => {
            if (m.dataset.eventType === ev.name) {
              m.classList.add('hover-match');
            } else {
              m.classList.add('hover-dim');
            }
          });
        });
        el.addEventListener('mouseleave', () => {
          document.querySelectorAll('.event').forEach(m => {
            m.classList.remove('hover-match', 'hover-dim');
          });
        });
      }
      col.appendChild(el);
    });

    daysContainer.appendChild(col);
  });

  addStartLines(data, hourHeight, null);
  updateTimeLabels(hourHeight, null);
}

function populatePoolSelect() {
  const select = document.getElementById('pool-select');
  const boroughs = [...new Set(POOLS.map(p => p.borough))];
  boroughs.forEach(borough => {
    const group = document.createElement('optgroup');
    group.label = borough;
    POOLS.filter(p => p.borough === borough).forEach(pool => {
      const opt = document.createElement('option');
      opt.value = pool.code;
      opt.textContent = pool.name;
      group.appendChild(opt);
    });
    select.appendChild(group);
  });

  const saved = localStorage.getItem('selectedPool');
  const params = new URLSearchParams(window.location.search);
  const fromUrl = params.get('facility');
  const code = fromUrl || saved || 'B250';
  if (POOLS.some(p => p.code === code)) {
    select.value = code;
  }

  select.addEventListener('change', () => {
    const code = select.value;
    localStorage.setItem('selectedPool', code);
    const url = new URL(window.location);
    url.searchParams.set('facility', code);
    window.history.replaceState(null, '', url);
    loadSchedule(code);
  });

  return select.value;
}

function updateParksLink(code) {
  const link = document.querySelector('.parks-link');
  link.href = `https://www.nycgovparks.org/facilities/recreationcenters/${code}/schedule#Pool`;
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

  if (scheduleData) {
    const hh = getHourHeight();
    addStartLines(scheduleData, hh, null);
    updateTimeLabels(hh, null);
  }
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

async function generatePDF() {
  if (!scheduleData || scheduleData.days.length === 0) return;

  const btn = document.getElementById('btn-pdf');
  btn.disabled = true;
  btn.textContent = 'Generating...';

  try {
    const { jsPDF } = window.jspdf;
    const margin = 0.5;
    const pageW = 11;
    const pageH = 8.5;
    const contentW = pageW - 2 * margin;
    const contentH = pageH - 2 * margin;

    const doc = new jsPDF({ unit: 'in', format: 'letter', orientation: 'landscape' });

    const GREEN_DARK = [52, 84, 29];
    const GREEN_MID = [99, 144, 65];
    const TEXT_LIGHT = [112, 112, 112];
    const BORDER = [221, 221, 221];
    const GRID = [238, 238, 238];
    const CLOSED_TEXT = [107, 114, 128];

    // --- Title ---
    const title = document.getElementById('center-name').textContent.replace(/—/g, '-');
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(16);
    doc.setTextColor(...GREEN_DARK);
    doc.text(title, margin, margin + 0.18);

    // --- Layout ---
    const calTop = margin + 0.35;
    const gutterW = 0.55;
    const headerH = 0.4;
    const numDays = scheduleData.days.length;
    const dayW = (contentW - gutterW) / numDays;
    const gridTop = calTop + headerH;
    const gridLeft = margin + gutterW;
    const gridH = contentH - (calTop - margin) - headerH;
    const hourH = gridH / TOTAL_HOURS;
    const gridBottom = gridTop + gridH;
    const gridRight = margin + contentW;

    // --- Day header background ---
    doc.setFillColor(245, 245, 245);
    doc.rect(margin, calTop, contentW, headerH, 'F');

    // --- Day header text ---
    scheduleData.days.forEach((day, i) => {
      const centerX = gridLeft + i * dayW + dayW / 2;
      doc.setFont('helvetica', 'bold');
      doc.setFontSize(9);
      doc.setTextColor(...GREEN_DARK);
      doc.text(day.dayName, centerX, calTop + 0.17, { align: 'center' });

      doc.setFont('helvetica', 'normal');
      doc.setFontSize(8);
      doc.setTextColor(...TEXT_LIGHT);
      doc.text(day.date, centerX, calTop + 0.3, { align: 'center' });
    });

    // --- Header bottom accent ---
    doc.setDrawColor(...GREEN_MID);
    doc.setLineWidth(0.02);
    doc.line(margin, gridTop, gridRight, gridTop);

    // --- Hour gridlines ---
    doc.setDrawColor(...GRID);
    doc.setLineWidth(0.003);
    for (let h = 1; h < TOTAL_HOURS; h++) {
      const y = gridTop + h * hourH;
      doc.line(gridLeft, y, gridRight, y);
    }

    // --- Column dividers ---
    doc.setDrawColor(...BORDER);
    doc.setLineWidth(0.005);
    doc.line(gridLeft, calTop, gridLeft, gridBottom);
    for (let i = 1; i < numDays; i++) {
      const x = gridLeft + i * dayW;
      doc.line(x, calTop, x, gridBottom);
    }

    // --- Time labels ---
    doc.setFont('helvetica', 'normal');
    doc.setFontSize(7);
    doc.setTextColor(...TEXT_LIGHT);
    for (let h = 0; h < TOTAL_HOURS; h++) {
      const hour = START_HOUR + h;
      const label = formatTimeShort(hour, 0);
      const y = gridTop + h * hourH + 0.08;
      doc.text(label, gridLeft - 0.06, y, { align: 'right' });
    }

    // --- Events ---
    scheduleData.days.forEach((day, i) => {
      day.events.forEach(ev => {
        if (activeFilter && ev.name !== activeFilter) return;

        const startMin = minutesFromStart(ev.startHour, ev.startMinute);
        const endMin = minutesFromStart(ev.endHour, ev.endMinute);
        const duration = endMin - startMin;
        if (startMin < 0 || duration <= 0) return;

        const x = gridLeft + i * dayW + 0.03;
        const w = dayW - 0.06;
        const y = gridTop + (startMin / 60) * hourH + 0.008;
        const h = (duration / 60) * hourH - 0.016;
        const closed = isClosed(ev.name);

        doc.setFillColor(255, 255, 255);
        doc.setDrawColor(closed ? 255 : GREEN_DARK[0], closed ? 255 : GREEN_DARK[1], closed ? 255 : GREEN_DARK[2]);
        doc.setLineWidth(closed ? 0.003 : 0.014);
        doc.roundedRect(x, y, w, h, 0.02, 0.02, 'FD');

        doc.setTextColor(closed ? CLOSED_TEXT[0] : GREEN_DARK[0], closed ? CLOSED_TEXT[1] : GREEN_DARK[1], closed ? CLOSED_TEXT[2] : GREEN_DARK[2]);
        doc.setFont('helvetica', 'bold');
        doc.setFontSize(6);

        let name = ev.name;
        const maxW = w - 0.06;
        while (doc.getTextWidth(name) > maxW && name.length > 3) {
          name = name.slice(0, -1);
        }
        if (name !== ev.name) name += '...';
        doc.text(name, x + 0.03, y + 0.09);

        if (h > 0.2) {
          doc.setFont('helvetica', 'normal');
          doc.setFontSize(5.5);
          const timeStr = formatTimeShort(ev.startHour, ev.startMinute) + '-' + formatTimeShort(ev.endHour, ev.endMinute);
          doc.text(timeStr, x + 0.03, y + 0.18);
        }
      });
    });

    // --- Outer border ---
    doc.setDrawColor(...BORDER);
    doc.setLineWidth(0.01);
    doc.rect(margin, calTop, contentW, headerH + gridH);

    // --- Save ---
    const pool = POOLS.find(p => p.code === document.getElementById('pool-select').value);
    const filename = pool ? pool.name.toLowerCase().replace(/[^a-z0-9]+/g, '-') : 'pool-schedule';
    doc.save(filename + '-schedule.pdf');
  } finally {
    btn.disabled = false;
    btn.textContent = 'Save PDF';
  }
}

document.getElementById('btn-pdf').addEventListener('click', generatePDF);
document.getElementById('btn-ics').addEventListener('click', generateICS);
document.getElementById('btn-reset').addEventListener('click', (e) => {
  e.preventDefault();
  clearFilter();
});

async function loadSchedule(facilityCode) {
  document.getElementById('loading').hidden = false;
  document.getElementById('calendar').hidden = true;
  document.getElementById('error').hidden = true;
  document.getElementById('closed-notice').hidden = true;
  document.getElementById('toolbar').hidden = false;
  clearFilter();
  updateParksLink(facilityCode);

  try {
    const resp = await fetch(`/api/schedule?facility=${facilityCode}`);
    if (!resp.ok) throw new Error('Failed to load schedule');
    scheduleData = await resp.json();

    if (scheduleData.error) throw new Error(scheduleData.error);

    document.getElementById('loading').hidden = true;

    const pool = POOLS.find(p => p.code === facilityCode);
    const displayName = pool ? pool.name : (scheduleData.centerName || 'Pool Schedule');
    document.getElementById('center-name').textContent = displayName + ' — Pool Schedule';
    document.title = displayName + ' — Pool Schedule';

    if (scheduleData.closed) {
      document.getElementById('toolbar').hidden = true;
      const notice = document.getElementById('closed-notice');
      notice.hidden = false;
      document.getElementById('closed-link').href =
        `https://www.nycgovparks.org/facilities/recreationcenters/${facilityCode}/schedule`;
    } else {
      document.getElementById('calendar').hidden = false;
      renderCalendar(scheduleData);
    }
  } catch (err) {
    document.getElementById('loading').hidden = true;
    const errorEl = document.getElementById('error');
    errorEl.hidden = false;
    errorEl.textContent = `Could not load schedule: ${err.message}`;
  }
}

const initialCode = populatePoolSelect();
loadSchedule(initialCode);
