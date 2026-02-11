import * as fs from 'fs';
import * as path from 'path';
import { fileURLToPath } from 'url';
import type { Event, EventsData } from './types.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const EVENTS_URL = 'https://raw.githubusercontent.com/johnbeynon/railwaymodellingdirectory/main/uk/events.json';
const DIST_DIR = path.join(__dirname, '..', 'dist');

async function fetchEvents(): Promise<Event[]> {
  console.log('Fetching events data...');
  try {
    const response = await fetch(EVENTS_URL);
    if (!response.ok) {
      throw new Error(`Failed to fetch events: ${response.statusText}`);
    }
    const data: EventsData = await response.json();

    // Handle both formats: { events: [...] } or [...]
    const events = Array.isArray(data) ? data : (data.events || []);
    console.log(`✓ Fetched ${events.length} events`);
    return events;
  } catch (error) {
    console.error('Error fetching events:', error);
    throw error;
  }
}

function sortEventsByDate(events: Event[]): Event[] {
  return events.sort((a, b) => {
    const dateA = a.startDate || a.start_date || a.date || '';
    const dateB = b.startDate || b.start_date || b.date || '';

    // Sort in descending order (most recent first)
    if (dateB < dateA) return -1;
    if (dateB > dateA) return 1;
    return 0;
  });
}

function formatDate(event: Event): string {
  const startDate = event.startDate || event.start_date || event.date;
  const endDate = event.endDate || event.end_date;

  if (!startDate) return 'Date TBA';

  if (endDate && endDate !== startDate) {
    return `${startDate} - ${endDate}`;
  }

  return startDate;
}

function extractCounties(events: Event[]): Map<string, number> {
  const countyMap = new Map<string, number>();

  events.forEach(event => {
    const county = event.county || 'Not Specified';
    countyMap.set(county, (countyMap.get(county) || 0) + 1);
  });

  // Sort counties alphabetically, but put "Not Specified" at the end
  const sortedEntries = Array.from(countyMap.entries()).sort((a, b) => {
    if (a[0] === 'Not Specified') return 1;
    if (b[0] === 'Not Specified') return -1;
    return a[0].localeCompare(b[0]);
  });

  return new Map(sortedEntries);
}

function filterEventsByCurrentMonth(events: Event[]): Event[] {
  const now = new Date();
  const currentYear = now.getFullYear();
  const currentMonth = now.getMonth(); // 0-11

  return events.filter(event => {
    const startDateStr = event.startDate || event.start_date || event.date;
    if (!startDateStr) return false;

    // Parse the date string (assuming YYYY-MM-DD format)
    const eventDate = new Date(startDateStr);

    return eventDate.getFullYear() === currentYear &&
           eventDate.getMonth() === currentMonth;
  });
}

function groupEventsByMonth(events: Event[], year: number): Map<number, Event[]> {
  const monthMap = new Map<number, Event[]>();

  events.forEach(event => {
    const startDateStr = event.startDate || event.start_date || event.date;
    if (!startDateStr) return;

    const eventDate = new Date(startDateStr);
    if (eventDate.getFullYear() !== year) return;

    const month = eventDate.getMonth(); // 0-11
    if (!monthMap.has(month)) {
      monthMap.set(month, []);
    }
    monthMap.get(month)!.push(event);
  });

  return monthMap;
}

function getMonthName(monthIndex: number): string {
  const months = [
    'January', 'February', 'March', 'April', 'May', 'June',
    'July', 'August', 'September', 'October', 'November', 'December'
  ];
  return months[monthIndex];
}

function generateNavigation(activePage: 'events' | 'shops' | 'layouts', pathPrefix: string = ''): string {
  return `
    <nav class="main-nav">
      <a href="${pathPrefix}index.html" class="nav-link ${activePage === 'events' ? 'active' : ''}">
        🚂 Events
      </a>
      <a href="${pathPrefix}shops.html" class="nav-link ${activePage === 'shops' ? 'active' : ''}">
        🏪 Shops
      </a>
      <a href="${pathPrefix}layouts.html" class="nav-link ${activePage === 'layouts' ? 'active' : ''}">
        🚃 Layouts
      </a>
    </nav>
  `;
}

function slugify(text: string): string {
  return text
    .toLowerCase()
    .replace(/\s+/g, '-')
    .replace(/[^a-z0-9-]/g, '');
}

function generateHTML(events: Event[], countyMap: Map<string, number>, thisMonthEvents: Event[], monthlyEvents: Map<number, Event[]>, selectedCounty?: string): string {
  const isCountyPage = selectedCounty && selectedCounty !== 'all';
  const pageTitle = isCountyPage
    ? `Railway Modelling Events in ${selectedCounty}`
    : 'Railway Modelling Events';
  const pathPrefix = isCountyPage ? '../' : '';
  return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Railway Modelling Events</title>
  <style>
    * {
      margin: 0;
      padding: 0;
      box-sizing: border-box;
    }

    body {
      font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Oxygen, Ubuntu, Cantarell, sans-serif;
      line-height: 1.6;
      color: #333;
      background-color: #f5f5f5;
      padding: 20px;
    }

    .container {
      max-width: 1200px;
      margin: 0 auto;
    }

    header {
      background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
      color: white;
      padding: 40px 30px;
      border-radius: 12px;
      margin-bottom: 30px;
      box-shadow: 0 4px 6px rgba(0, 0, 0, 0.1);
    }

    h1 {
      font-size: 2.5rem;
      margin-bottom: 10px;
    }

    .subtitle {
      font-size: 1.1rem;
      opacity: 0.95;
    }

    .events-count {
      background: rgba(255, 255, 255, 0.2);
      display: inline-flex;
      align-items: center;
      padding: 8px 16px;
      border-radius: 20px;
      font-weight: 500;
      line-height: 1;
    }

    footer {
      text-align: center;
      padding: 20px;
      color: #666;
      font-size: 0.9rem;
    }

    /* Navigation Styles */
    .main-nav {
      display: flex;
      gap: 15px;
      justify-content: center;
      background: white;
      border-radius: 10px;
      padding: 20px;
      margin-bottom: 30px;
      box-shadow: 0 2px 8px rgba(0, 0, 0, 0.1);
      flex-wrap: wrap;
    }

    .nav-link {
      text-decoration: none;
      color: #555;
      font-weight: 600;
      font-size: 1.1rem;
      padding: 12px 24px;
      border-radius: 25px;
      transition: all 0.2s;
      border: 2px solid transparent;
    }

    .nav-link:hover {
      background: #f5f5f5;
      border-color: #667eea;
      color: #667eea;
    }

    .nav-link.active {
      background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
      color: white;
      box-shadow: 0 2px 8px rgba(102, 126, 234, 0.3);
    }

    /* Filter Section Styles */
    .filter-section {
      background: white;
      border-radius: 10px;
      padding: 25px;
      margin-bottom: 30px;
      box-shadow: 0 2px 8px rgba(0, 0, 0, 0.1);
    }

    .filter-title {
      font-size: 1.3rem;
      color: #667eea;
      margin-bottom: 15px;
    }

    .filter-buttons {
      display: flex;
      flex-wrap: wrap;
      gap: 10px;
      margin-bottom: 15px;
    }

    .filter-btn {
      background: #f5f5f5;
      border: 2px solid #e0e0e0;
      border-radius: 25px;
      padding: 10px 20px;
      font-size: 0.95rem;
      font-weight: 500;
      color: #555;
      cursor: pointer;
      transition: all 0.2s;
      font-family: inherit;
    }

    .filter-btn:hover {
      background: #e8e8e8;
      border-color: #667eea;
      color: #667eea;
    }

    .filter-btn.active {
      background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
      border-color: #667eea;
      color: white;
      box-shadow: 0 2px 8px rgba(102, 126, 234, 0.3);
    }

    .active-filter-display {
      color: #666;
      font-size: 0.95rem;
      padding-top: 10px;
      border-top: 1px solid #f0f0f0;
    }

    .active-filter-display strong {
      color: #667eea;
      font-weight: 600;
    }

    /* This Month Section Styles */
    .this-month-section {
      background: linear-gradient(135deg, rgba(102, 126, 234, 0.05) 0%, rgba(118, 75, 162, 0.05) 100%);
      border: 2px solid #667eea;
      border-radius: 10px;
      padding: 25px;
      margin-bottom: 30px;
    }

    .this-month-header {
      display: flex;
      align-items: center;
      gap: 10px;
      margin-bottom: 20px;
    }

    .map-view-btn {
      background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
      color: white;
      padding: 8px 20px;
      border-radius: 20px;
      font-size: 0.9rem;
      font-weight: 600;
      box-shadow: 0 2px 6px rgba(102, 126, 234, 0.3);
      transition: all 0.2s;
      border: none;
      cursor: pointer;
    }

    .map-view-btn:hover {
      transform: translateY(-2px);
      box-shadow: 0 4px 12px rgba(102, 126, 234, 0.4);
    }

    .calendar-btn {
      background: white;
      color: #667eea;
      padding: 8px 20px;
      border-radius: 20px;
      font-size: 0.9rem;
      font-weight: 600;
      border: 2px solid #667eea;
      cursor: pointer;
      transition: all 0.2s;
      text-decoration: none;
      display: inline-flex;
      align-items: center;
      line-height: 1;
    }

    .calendar-btn:hover {
      background: #667eea;
      color: white;
      transform: translateY(-2px);
      box-shadow: 0 4px 12px rgba(102, 126, 234, 0.3);
    }

    .this-month-title {
      font-size: 1.5rem;
      color: #667eea;
      font-weight: 700;
    }

    .this-month-badge {
      background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
      color: white;
      padding: 4px 12px;
      border-radius: 15px;
      font-size: 0.85rem;
      font-weight: 600;
    }

    .this-month-grid {
      display: grid;
      grid-template-columns: repeat(auto-fill, minmax(300px, 1fr));
      gap: 20px;
    }

    .this-month-event {
      background: white;
      border-radius: 8px;
      padding: 20px;
      border-left: 4px solid #667eea;
      box-shadow: 0 2px 4px rgba(0, 0, 0, 0.08);
      transition: transform 0.2s, box-shadow 0.2s;
    }

    .this-month-event:hover {
      transform: translateY(-2px);
      box-shadow: 0 4px 12px rgba(0, 0, 0, 0.12);
    }

    .this-month-event-name {
      color: #667eea;
      font-size: 1.2rem;
      font-weight: 600;
      margin-bottom: 12px;
    }

    .this-month-event-info {
      font-size: 0.9rem;
      color: #666;
      margin-bottom: 6px;
    }

    .this-month-empty {
      text-align: center;
      padding: 30px;
      color: #666;
      font-size: 1.1rem;
    }

    /* Monthly Sections Styles */
    .monthly-sections {
      margin-bottom: 30px;
    }

    .month-section {
      background: white;
      border-radius: 10px;
      padding: 25px;
      margin-bottom: 25px;
      box-shadow: 0 2px 8px rgba(0, 0, 0, 0.1);
      border-left: 4px solid #667eea;
    }

    .month-header {
      display: flex;
      align-items: center;
      gap: 10px;
      margin-bottom: 20px;
      padding-bottom: 15px;
      border-bottom: 2px solid #f0f0f0;
    }

    .month-title {
      font-size: 1.4rem;
      color: #667eea;
      font-weight: 700;
    }

    .month-badge {
      background: #667eea;
      color: white;
      padding: 4px 12px;
      border-radius: 15px;
      font-size: 0.8rem;
      font-weight: 600;
    }

    .month-grid {
      display: grid;
      grid-template-columns: repeat(auto-fill, minmax(280px, 1fr));
      gap: 18px;
    }

    .month-event {
      background: #f9f9f9;
      border-radius: 8px;
      padding: 18px;
      border-left: 3px solid #667eea;
      transition: transform 0.2s, box-shadow 0.2s;
    }

    .month-event:hover {
      transform: translateX(4px);
      box-shadow: 0 2px 8px rgba(0, 0, 0, 0.1);
      background: white;
    }

    .month-event-name {
      color: #333;
      font-size: 1.1rem;
      font-weight: 600;
      margin-bottom: 10px;
    }

    .month-event-info {
      font-size: 0.85rem;
      color: #666;
      margin-bottom: 5px;
    }

    @media (max-width: 768px) {
      h1 {
        font-size: 2rem;
      }

      header {
        padding: 30px 20px;
      }

      .this-month-section {
        padding: 20px 15px;
      }

      .this-month-grid {
        grid-template-columns: 1fr;
      }

      .this-month-title {
        font-size: 1.3rem;
      }

      .month-section {
        padding: 20px 15px;
      }

      .month-grid {
        grid-template-columns: 1fr;
      }

      .month-title {
        font-size: 1.2rem;
      }
    }
  </style>
</head>
<body>
  <div class="container">
    <header>
      <h1>🚂 ${pageTitle}</h1>
      <p class="subtitle">Discover upcoming railway modelling events across the UK</p>
      <div style="display: flex; gap: 15px; align-items: center; margin-top: 15px; flex-wrap: wrap;">
        <div class="events-count">${events.length} ${events.length === 1 ? 'Event' : 'Events'} Listed</div>
        ${isCountyPage ? `
        <a href="${slugify(selectedCounty!)}.ics" download="${selectedCounty} Events.ics" class="calendar-btn">
          📅 Add to Calendar
        </a>
        ` : ''}
      </div>
    </header>

    ${generateNavigation('events', pathPrefix)}

    <div class="filter-section">
      <h3 class="filter-title">Filter by County</h3>
      <div class="filter-buttons">
        <a href="${isCountyPage ? '../' : ''}index.html" class="filter-btn ${!isCountyPage ? 'active' : ''}" style="text-decoration: none;">
          All Counties (${Array.from(countyMap.values()).reduce((a, b) => a + b, 0)})
        </a>
        ${Array.from(countyMap.entries())
          .map(([county, count]) => {
            const isActive = selectedCounty === county;
            const slug = slugify(county);
            return `
        <a href="${isCountyPage ? '' : 'events/'}${slug}.html" class="filter-btn ${isActive ? 'active' : ''}" style="text-decoration: none;">
          ${escapeHtml(county)} (${count})
        </a>
            `;
          })
          .join('')}
      </div>
      <div class="active-filter-display">
        ${isCountyPage ? `Showing events in <strong>${escapeHtml(selectedCounty!)}</strong>` : `Showing <strong>all events</strong>`}
      </div>
    </div>

    ${thisMonthEvents.length > 0 ? `
    <div class="this-month-section">
      <div class="this-month-header">
        <h2 class="this-month-title">📅 This Month</h2>
        <span class="this-month-badge">${thisMonthEvents.length} ${thisMonthEvents.length === 1 ? 'Event' : 'Events'}</span>
        <a href="${isCountyPage ? '../' : ''}map.html" class="map-view-btn" style="margin-left: auto; text-decoration: none;">
          🗺️ View on Map
        </a>
      </div>
      <div class="this-month-grid">
        ${thisMonthEvents.map(event => {
          const county = event.county || 'Not Specified';
          const organizer = event.organizer || event.organiser;
          const eventTitle = organizer
            ? `${escapeHtml(event.name)} by ${escapeHtml(organizer)}`
            : escapeHtml(event.name);
          return `
        <div class="this-month-event" data-county="${escapeHtml(county)}">
          <h3 class="this-month-event-name">${eventTitle}</h3>
          <div class="this-month-event-info">📅 ${formatDate(event)}</div>
          ${event.county ? `<div class="this-month-event-info">🏛️ ${escapeHtml(county)}</div>` : ''}
          ${event.venue ? `<div class="this-month-event-info">📍 ${escapeHtml(event.venue)}</div>` : ''}
          ${event.url ? `
          <div style="margin-top: 12px;">
            <a href="${escapeHtml(event.url)}" target="_blank" rel="noopener noreferrer" style="color: #667eea; text-decoration: none; font-weight: 600;">
              More Info →
            </a>
          </div>
          ` : ''}
        </div>
          `;
        }).join('')}
      </div>
    </div>
    ` : ''}

    ${monthlyEvents.size > 0 ? `
    <div class="monthly-sections">
      <h2 style="font-size: 1.8rem; color: #667eea; margin-bottom: 25px; padding-left: 10px;">📅 Events by Month</h2>
      ${Array.from(monthlyEvents.entries())
        .sort((a, b) => a[0] - b[0]) // Sort by month number
        .map(([monthIndex, monthEvents]) => {
          const currentMonth = new Date().getMonth();
          // Skip current month as it's already shown in "This Month" section
          if (monthIndex === currentMonth) return '';

          return `
      <div class="month-section">
        <div class="month-header">
          <h3 class="month-title">${getMonthName(monthIndex)} 2026</h3>
          <span class="month-badge">${monthEvents.length} ${monthEvents.length === 1 ? 'Event' : 'Events'}</span>
        </div>
        <div class="month-grid">
          ${monthEvents.map(event => {
            const county = event.county || 'Not Specified';
            const organizer = event.organizer || event.organiser;
            const eventTitle = organizer
              ? `${escapeHtml(event.name)} by ${escapeHtml(organizer)}`
              : escapeHtml(event.name);
            return `
          <div class="month-event" data-county="${escapeHtml(county)}">
            <h4 class="month-event-name">${eventTitle}</h4>
            <div class="month-event-info">📅 ${formatDate(event)}</div>
            ${event.county ? `<div class="month-event-info">🏛️ ${escapeHtml(county)}</div>` : ''}
            ${event.venue ? `<div class="month-event-info">📍 ${escapeHtml(event.venue)}</div>` : ''}
            ${event.url ? `
            <div style="margin-top: 10px;">
              <a href="${escapeHtml(event.url)}" target="_blank" rel="noopener noreferrer" style="color: #667eea; text-decoration: none; font-weight: 600; font-size: 0.85rem;">
                More Info →
              </a>
            </div>
            ` : ''}
          </div>
            `;
          }).join('')}
        </div>
      </div>
          `;
        })
        .filter(html => html !== '') // Remove empty strings (current month)
        .join('')}
    </div>
    ` : ''}

    <footer>
      <p>Built with ❤️ for the railway modelling community</p>
      <p style="margin-top: 8px; font-size: 0.85rem;">
        Last updated: ${new Date().toLocaleDateString('en-GB', {
          day: 'numeric',
          month: 'long',
          year: 'numeric'
        })}
      </p>
    </footer>
  </div>

</body>
</html>`;
}

function generateComingSoonPage(
  title: string,
  icon: string,
  description: string,
  activePage: 'shops' | 'layouts'
): string {
  return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>${title} - Railway Modelling Directory</title>
  <style>
    * {
      margin: 0;
      padding: 0;
      box-sizing: border-box;
    }

    body {
      font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Oxygen, Ubuntu, Cantarell, sans-serif;
      line-height: 1.6;
      color: #333;
      background-color: #f5f5f5;
      padding: 20px;
    }

    .container {
      max-width: 1200px;
      margin: 0 auto;
    }

    header {
      background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
      color: white;
      padding: 40px 30px;
      border-radius: 12px;
      margin-bottom: 30px;
      box-shadow: 0 4px 6px rgba(0, 0, 0, 0.1);
    }

    h1 {
      font-size: 2.5rem;
      margin-bottom: 10px;
    }

    .subtitle {
      font-size: 1.1rem;
      opacity: 0.95;
    }

    /* Navigation Styles */
    .main-nav {
      display: flex;
      gap: 15px;
      justify-content: center;
      background: white;
      border-radius: 10px;
      padding: 20px;
      margin-bottom: 30px;
      box-shadow: 0 2px 8px rgba(0, 0, 0, 0.1);
      flex-wrap: wrap;
    }

    .nav-link {
      text-decoration: none;
      color: #555;
      font-weight: 600;
      font-size: 1.1rem;
      padding: 12px 24px;
      border-radius: 25px;
      transition: all 0.2s;
      border: 2px solid transparent;
    }

    .nav-link:hover {
      background: #f5f5f5;
      border-color: #667eea;
      color: #667eea;
    }

    .nav-link.active {
      background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
      color: white;
      box-shadow: 0 2px 8px rgba(102, 126, 234, 0.3);
    }

    .coming-soon-section {
      background: white;
      border-radius: 10px;
      padding: 60px 30px;
      text-align: center;
      box-shadow: 0 2px 8px rgba(0, 0, 0, 0.1);
      margin-bottom: 30px;
    }

    .coming-soon-icon {
      font-size: 5rem;
      margin-bottom: 20px;
    }

    .coming-soon-title {
      font-size: 2.5rem;
      color: #667eea;
      margin-bottom: 20px;
    }

    .coming-soon-description {
      font-size: 1.2rem;
      color: #666;
      max-width: 600px;
      margin: 0 auto 30px;
      line-height: 1.8;
    }

    .coming-soon-badge {
      display: inline-block;
      background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
      color: white;
      padding: 12px 30px;
      border-radius: 25px;
      font-weight: 600;
      font-size: 1.1rem;
      box-shadow: 0 2px 8px rgba(102, 126, 234, 0.3);
    }

    footer {
      text-align: center;
      padding: 20px;
      color: #666;
      font-size: 0.9rem;
    }

    @media (max-width: 768px) {
      h1 {
        font-size: 2rem;
      }

      header {
        padding: 30px 20px;
      }

      .coming-soon-section {
        padding: 40px 20px;
      }

      .coming-soon-icon {
        font-size: 4rem;
      }

      .coming-soon-title {
        font-size: 2rem;
      }

      .coming-soon-description {
        font-size: 1rem;
      }
    }
  </style>
</head>
<body>
  <div class="container">
    <header>
      <h1>${icon} ${title}</h1>
      <p class="subtitle">Your complete guide to railway modelling in the UK</p>
    </header>

    ${generateNavigation(activePage)}

    <main>
      <div class="coming-soon-section">
        <div class="coming-soon-icon">${icon}</div>
        <h2 class="coming-soon-title">${title}</h2>
        <p class="coming-soon-description">${description}</p>
        <div class="coming-soon-badge">Coming Soon</div>
      </div>
    </main>

    <footer>
      <p>Built with ❤️ for the railway modelling community</p>
      <p style="margin-top: 8px; font-size: 0.85rem;">
        Last updated: ${new Date().toLocaleDateString('en-GB', {
          day: 'numeric',
          month: 'long',
          year: 'numeric'
        })}
      </p>
    </footer>
  </div>
</body>
</html>`;
}

function generateMapPage(events: Event[]): string {
  const eventsJSON = JSON.stringify(events.map(event => ({
    name: event.name,
    organizer: event.organizer || event.organiser || '',
    date: formatDate(event),
    venue: event.venue || '',
    location: event.location || '',
    county: event.county || '',
    url: event.url || ''
  })));

  return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>This Month's Events - Map View</title>
  <link rel="stylesheet" href="https://unpkg.com/leaflet@1.9.4/dist/leaflet.css" />
  <style>
    * {
      margin: 0;
      padding: 0;
      box-sizing: border-box;
    }

    body {
      font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Oxygen, Ubuntu, Cantarell, sans-serif;
      line-height: 1.6;
      color: #333;
      background-color: #f5f5f5;
    }

    .container {
      max-width: 100%;
      height: 100vh;
      display: flex;
      flex-direction: column;
    }

    header {
      background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
      color: white;
      padding: 20px 30px;
      box-shadow: 0 2px 6px rgba(0, 0, 0, 0.1);
      display: flex;
      justify-content: space-between;
      align-items: center;
      flex-wrap: wrap;
      gap: 15px;
    }

    h1 {
      font-size: 1.8rem;
      margin: 0;
    }

    .back-link {
      color: white;
      text-decoration: none;
      padding: 8px 20px;
      background: rgba(255, 255, 255, 0.2);
      border-radius: 20px;
      font-weight: 600;
      transition: all 0.2s;
    }

    .back-link:hover {
      background: rgba(255, 255, 255, 0.3);
    }

    #map {
      flex: 1;
      width: 100%;
    }

    .loading-overlay {
      position: absolute;
      top: 80px;
      left: 50%;
      transform: translateX(-50%);
      background: white;
      padding: 20px 40px;
      border-radius: 10px;
      box-shadow: 0 4px 12px rgba(0, 0, 0, 0.15);
      z-index: 1000;
      font-weight: 600;
      color: #667eea;
    }

    .leaflet-popup-content {
      margin: 15px;
      line-height: 1.6;
    }

    .popup-title {
      font-size: 1.1rem;
      font-weight: 700;
      color: #667eea;
      margin-bottom: 10px;
    }

    .popup-info {
      margin: 5px 0;
      font-size: 0.9rem;
      color: #666;
    }

    .popup-link {
      display: inline-block;
      margin-top: 10px;
      color: #667eea;
      text-decoration: none;
      font-weight: 600;
    }

    .popup-link:hover {
      text-decoration: underline;
    }

    @media (max-width: 768px) {
      h1 {
        font-size: 1.4rem;
      }

      header {
        padding: 15px 20px;
      }
    }
  </style>
</head>
<body>
  <div class="container">
    <header>
      <h1>🗺️ This Month's Events - Map View</h1>
      <a href="index.html" class="back-link">← Back to Events</a>
    </header>
    <div id="map"></div>
    <div id="loading" class="loading-overlay">Loading map...</div>
  </div>

  <script src="https://unpkg.com/leaflet@1.9.4/dist/leaflet.js"></script>
  <script>
    const events = ${eventsJSON};

    // Initialize map centered on UK
    const map = L.map('map').setView([54.5, -2.0], 6);

    // Add OpenStreetMap tile layer
    L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
      attribution: '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors',
      maxZoom: 18,
    }).addTo(map);

    const loadingEl = document.getElementById('loading');
    let geocodedCount = 0;

    // Function to geocode an address
    async function geocodeAddress(query) {
      try {
        const response = await fetch(
          \`https://nominatim.openstreetmap.org/search?format=json&q=\${encodeURIComponent(query)}&countrycodes=gb&limit=1\`,
          {
            headers: {
              'User-Agent': 'RailwayModellingEvents/1.0'
            }
          }
        );
        const data = await response.json();
        return data[0] || null;
      } catch (error) {
        console.error('Geocoding error:', error);
        return null;
      }
    }

    // Function to create popup content
    function createPopupContent(event) {
      const eventTitle = event.organizer
        ? \`\${event.name} by \${event.organizer}\`
        : event.name;
      return \`
        <div class="popup-title">\${eventTitle}</div>
        <div class="popup-info">📅 \${event.date}</div>
        \${event.county ? \`<div class="popup-info">🏛️ \${event.county}</div>\` : ''}
        \${event.venue ? \`<div class="popup-info">📍 \${event.venue}</div>\` : ''}
        \${event.url ? \`<a href="\${event.url}" target="_blank" rel="noopener noreferrer" class="popup-link">More Info →</a>\` : ''}
      \`;
    }

    // Geocode and add markers for each event
    async function addEventMarkers() {
      for (const event of events) {
        // Build query string - try venue first, then location, then county
        let query = '';
        if (event.venue && event.county) {
          query = \`\${event.venue}, \${event.county}, UK\`;
        } else if (event.location && event.county) {
          query = \`\${event.location}, \${event.county}, UK\`;
        } else if (event.venue) {
          query = \`\${event.venue}, UK\`;
        } else if (event.location) {
          query = \`\${event.location}, UK\`;
        } else if (event.county) {
          query = \`\${event.county}, UK\`;
        }

        if (!query) {
          console.warn('No location data for event:', event.name);
          continue;
        }

        // Add delay to respect Nominatim usage policy (max 1 request per second)
        await new Promise(resolve => setTimeout(resolve, 1000));

        const result = await geocodeAddress(query);

        if (result) {
          const marker = L.marker([parseFloat(result.lat), parseFloat(result.lon)])
            .addTo(map)
            .bindPopup(createPopupContent(event));

          geocodedCount++;
          loadingEl.textContent = \`Loading map... (\${geocodedCount}/\${events.length})\`;
        } else {
          console.warn('Could not geocode:', query, 'for event:', event.name);
        }
      }

      loadingEl.style.display = 'none';

      // Adjust map bounds to show all markers if any were added
      if (geocodedCount > 0) {
        const group = new L.featureGroup(map._layers);
        if (Object.keys(group._layers).length > 0) {
          map.fitBounds(group.getBounds().pad(0.1));
        }
      }
    }

    // Start geocoding
    addEventMarkers();
  </script>
</body>
</html>`;
}

function escapeHtml(unsafe: string | number | undefined): string {
  if (unsafe === undefined || unsafe === null) return '';
  const str = String(unsafe);
  return str
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#039;");
}

function escapeICS(text: string): string {
  return text
    .replace(/\\/g, '\\\\')
    .replace(/;/g, '\\;')
    .replace(/,/g, '\\,')
    .replace(/\n/g, '\\n');
}

function formatICSDate(dateStr: string): string {
  // Convert YYYY-MM-DD to YYYYMMDD for ICS format
  return dateStr.replace(/-/g, '');
}

function generateICS(events: Event[], countyName: string): string {
  const now = new Date();
  const timestamp = now.toISOString().replace(/[-:]/g, '').split('.')[0] + 'Z';

  let icsContent = `BEGIN:VCALENDAR
VERSION:2.0
PRODID:-//Railway Modelling Events//Events Calendar//EN
CALSCALE:GREGORIAN
METHOD:PUBLISH
X-WR-CALNAME:Railway Modelling Events - ${countyName}
X-WR-CALDESC:Railway modelling events in ${countyName}
X-WR-TIMEZONE:Europe/London
`;

  events.forEach((event, index) => {
    const startDateStr = event.startDate || event.start_date || event.date;
    if (!startDateStr) return;

    const endDateStr = event.endDate || event.end_date || startDateStr;
    const startDate = formatICSDate(startDateStr);
    const endDate = formatICSDate(endDateStr);

    // For all-day events, the end date should be the day AFTER the last day
    const endDateObj = new Date(endDateStr);
    endDateObj.setDate(endDateObj.getDate() + 1);
    const endDatePlusOne = formatICSDate(endDateObj.toISOString().split('T')[0]);

    const organizer = event.organizer || event.organiser || '';
    const eventTitle = organizer ? `${event.name} by ${organizer}` : event.name;
    const venue = event.venue || '';
    const county = event.county || '';
    const location = venue && county ? `${venue}, ${county}` : venue || county;

    const uid = `event-${index}-${startDate}@railwaymodellingevents.com`;

    icsContent += `
BEGIN:VEVENT
UID:${uid}
DTSTAMP:${timestamp}
DTSTART;VALUE=DATE:${startDate}
DTEND;VALUE=DATE:${endDatePlusOne}
SUMMARY:${escapeICS(eventTitle)}
${event.description ? `DESCRIPTION:${escapeICS(event.description)}` : ''}
${location ? `LOCATION:${escapeICS(location)}` : ''}
${event.url ? `URL:${event.url}` : ''}
STATUS:CONFIRMED
TRANSP:TRANSPARENT
END:VEVENT
`;
  });

  icsContent += 'END:VCALENDAR\n';
  return icsContent;
}

async function build() {
  console.log('🚂 Building Railway Modelling Events website...\n');

  // Create dist directory
  if (!fs.existsSync(DIST_DIR)) {
    fs.mkdirSync(DIST_DIR, { recursive: true });
  }

  // Fetch events
  const events = await fetchEvents();

  // Sort events by date (most recent first)
  const sortedEvents = sortEventsByDate(events);

  // Extract counties for filtering
  const countyMap = extractCounties(sortedEvents);

  // Filter events for current month
  const thisMonthEvents = filterEventsByCurrentMonth(sortedEvents);

  // Group events by month for 2026
  const monthlyEvents = groupEventsByMonth(sortedEvents, 2026);

  // Generate Events page (index.html)
  console.log('Generating HTML pages...');
  const eventsHTML = generateHTML(sortedEvents, countyMap, thisMonthEvents, monthlyEvents);
  const eventsPath = path.join(DIST_DIR, 'index.html');
  fs.writeFileSync(eventsPath, eventsHTML);
  console.log(`✓ Generated ${eventsPath}`);

  // Create events directory for county pages
  const eventsDir = path.join(DIST_DIR, 'events');
  if (!fs.existsSync(eventsDir)) {
    fs.mkdirSync(eventsDir, { recursive: true });
  }

  // Generate county-specific pages
  for (const [county, _count] of countyMap.entries()) {
    if (county === 'Not Specified') continue; // Skip "Not Specified" county

    const countyEvents = sortedEvents.filter(event => {
      const eventCounty = event.county || 'Not Specified';
      return eventCounty === county;
    });

    const countyThisMonthEvents = filterEventsByCurrentMonth(countyEvents);
    const countyMonthlyEvents = groupEventsByMonth(countyEvents, 2026);

    const countyHTML = generateHTML(countyEvents, countyMap, countyThisMonthEvents, countyMonthlyEvents, county);
    const countySlug = slugify(county);
    const countyPath = path.join(eventsDir, `${countySlug}.html`);
    fs.writeFileSync(countyPath, countyHTML);
    console.log(`✓ Generated ${countyPath}`);

    // Generate ICS file for county
    const countyICS = generateICS(countyEvents, county);
    const icsPath = path.join(eventsDir, `${countySlug}.ics`);
    fs.writeFileSync(icsPath, countyICS);
    console.log(`✓ Generated ${icsPath}`);
  }

  // Generate Shops page
  const shopsHTML = generateComingSoonPage(
    'Railway Modelling Shops',
    '🏪',
    'We\'re building a comprehensive directory of railway modelling shops across the UK. Check back soon to discover retailers near you!',
    'shops'
  );
  const shopsPath = path.join(DIST_DIR, 'shops.html');
  fs.writeFileSync(shopsPath, shopsHTML);
  console.log(`✓ Generated ${shopsPath}`);

  // Generate Layouts page
  const layoutsHTML = generateComingSoonPage(
    'Railway Modelling Layouts',
    '🚃',
    'We\'re creating a showcase of amazing railway modelling layouts from across the UK. Stay tuned for inspiration and ideas!',
    'layouts'
  );
  const layoutsPath = path.join(DIST_DIR, 'layouts.html');
  fs.writeFileSync(layoutsPath, layoutsHTML);
  console.log(`✓ Generated ${layoutsPath}`);

  // Generate Map page for this month's events
  const mapHTML = generateMapPage(thisMonthEvents);
  const mapPath = path.join(DIST_DIR, 'map.html');
  fs.writeFileSync(mapPath, mapHTML);
  console.log(`✓ Generated ${mapPath}`);

  console.log('\n✨ Build complete!');
  console.log(`\nTo view the site:`);
  console.log(`  1. Open ${eventsPath} in your browser`);
  console.log(`  2. Or run: npx serve dist`);
}

build().catch(error => {
  console.error('Build failed:', error);
  process.exit(1);
});
