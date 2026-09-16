const express = require('express');
const cheerio = require('cheerio');
const path = require('path');

const app = express();
const PORT = process.env.PORT || 3000;
const SCHEDULE_URL = 'https://www.nycgovparks.org/facilities/recreationcenters/B250/schedule';

app.use(express.static(path.join(__dirname, 'public')));

function parseTime(str) {
  const match = str.trim().match(/^(\d{1,2}):(\d{2})\s*([ap])/i);
  if (!match) return null;
  let hours = parseInt(match[1]);
  const minutes = parseInt(match[2]);
  const period = match[3].toLowerCase();
  if (period === 'p' && hours !== 12) hours += 12;
  if (period === 'a' && hours === 12) hours = 0;
  return { hours, minutes };
}

function parseScheduleHtml(html) {
  const $ = cheerio.load(html);

  const pageNotices = [];
  $('body > .container .alert, .tab-content').prevAll('.alert').each((_, el) => {
    const $el = $(el);
    const title = $el.find('h3').first().text().trim();
    const paragraphs = [];
    $el.find('p').each((_, p) => paragraphs.push($(p).text().trim()));
    let extraText = '';
    $el.contents().each((_, node) => {
      if (node.type === 'text') {
        const t = $(node).text().trim();
        if (t) extraText += (extraText ? ' ' : '') + t;
      }
    });
    if (title || paragraphs.length || extraText) {
      pageNotices.push({ title, text: [...paragraphs, extraText].filter(Boolean).join(' ') });
    }
  });

  const generalNotices = [];
  $('.alert').each((_, el) => {
    const $el = $(el);
    if ($el.closest('#Pool-schedule, #Center-schedule, #MediaLab-schedule, table').length) return;
    const title = $el.find('h3').first().text().trim();
    const textParts = [];
    $el.find('p').each((_, p) => textParts.push($(p).text().trim()));
    $el.contents().each((_, node) => {
      if (node.type === 'text') {
        const t = $(node).text().trim();
        if (t) textParts.push(t);
      }
    });
    if (title || textParts.length) {
      generalNotices.push({ title, text: textParts.filter(Boolean).join(' ') });
    }
  });

  const poolDiv = $('#Pool-schedule');
  if (!poolDiv.length) {
    return { days: [], notices: generalNotices, centerName: 'Pool Schedule' };
  }

  const nextLink = poolDiv.find('.pager .next a').attr('href') || '';
  const yearMatch = nextLink.match(/schedule\/(\d{4})-(\d{2})-(\d{2})/);
  let year = new Date().getFullYear();
  if (yearMatch) {
    const nextDate = new Date(parseInt(yearMatch[1]), parseInt(yearMatch[2]) - 1, parseInt(yearMatch[3]));
    year = nextDate.getFullYear();
  }

  const headers = [];
  poolDiv.find('table.schedule-table thead th').each((_, el) => {
    const $th = $(el);
    $th.find('br').replaceWith('\n');
    const parts = $th.text().trim().split(/\n/).map(s => s.trim()).filter(Boolean);
    headers.push({ dayName: parts[0] || '', date: parts[1] || '' });
  });

  const days = [];
  poolDiv.find('table.schedule-table tbody tr td').each((i, el) => {
    if (i >= headers.length) return;
    const td = $(el);
    const header = headers[i];

    const buildingHoursEl = td.find('.center-hrs');
    let buildingHours = '';
    if (buildingHoursEl.length) {
      buildingHours = buildingHoursEl.text().replace(/Building Hours/i, '').trim();
    }

    const dayNotices = [];
    td.find('.alert').each((_, alertEl) => {
      const title = $(alertEl).find('h3').text().trim();
      const msg = $(alertEl).find('p').text().trim();
      const plain = $(alertEl).text().trim();
      dayNotices.push({
        title,
        text: msg || plain
      });
    });

    const events = [];
    td.find('p.program').each((_, progEl) => {
      const $prog = $(progEl);
      const fullText = $prog.text();
      const timeMatch = fullText.match(/(\d{1,2}:\d{2}\s*[ap])\s*-\s*(\d{1,2}:\d{2}\s*[ap])/i);
      const name = $prog.find('strong').text().trim();
      const room = $prog.find('.room').text().trim();

      if (timeMatch && name) {
        const start = parseTime(timeMatch[1]);
        const end = parseTime(timeMatch[2]);
        events.push({
          name,
          startTime: timeMatch[1].trim(),
          endTime: timeMatch[2].trim(),
          startHour: start ? start.hours : 0,
          startMinute: start ? start.minutes : 0,
          endHour: end ? end.hours : 0,
          endMinute: end ? end.minutes : 0,
          room
        });
      }
    });

    const [month, day] = (header.date || '').split('/').map(Number);
    let fullDate = null;
    if (month && day) {
      fullDate = `${year}-${String(month).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
    }

    days.push({
      dayName: header.dayName,
      date: header.date,
      fullDate,
      buildingHours,
      notices: dayNotices,
      events
    });
  });

  const centerName = $('h1').first().text().trim() || 'Pool Schedule';

  return { days, notices: generalNotices, centerName };
}

app.get('/api/schedule', async (req, res) => {
  try {
    const response = await fetch(SCHEDULE_URL, {
      headers: {
        'User-Agent': 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36'
      }
    });
    if (!response.ok) {
      throw new Error(`NYC Parks returned ${response.status}`);
    }
    const html = await response.text();
    const schedule = parseScheduleHtml(html);
    res.json(schedule);
  } catch (err) {
    console.error('Failed to fetch schedule:', err.message);
    res.status(502).json({ error: 'Could not fetch schedule from NYC Parks' });
  }
});

app.listen(PORT, () => {
  console.log(`Pool schedule running at http://localhost:${PORT}`);
});
