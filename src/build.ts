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

function filterUpcomingEvents(events: Event[]): Event[] {
  const today = new Date();
  today.setHours(0, 0, 0, 0); // Start of today

  return events.filter(event => {
    // Use end date if available, otherwise use start date
    const endDateStr = event.endDate || event.end_date || event.startDate || event.start_date || event.date;
    if (!endDateStr) return false;

    const eventEndDate = new Date(endDateStr);
    eventEndDate.setHours(23, 59, 59, 999); // End of the event day

    // Keep events that end today or in the future
    return eventEndDate >= today;
  });
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

function getOrdinalSuffix(day: number): string {
  if (day > 3 && day < 21) return 'th';
  switch (day % 10) {
    case 1: return 'st';
    case 2: return 'nd';
    case 3: return 'rd';
    default: return 'th';
  }
}

function formatSingleDate(dateStr: string): string {
  const date = new Date(dateStr);
  const dayOfWeek = date.toLocaleDateString('en-GB', { weekday: 'long' });
  const day = date.getDate();
  const month = date.toLocaleDateString('en-GB', { month: 'short' });
  const year = date.getFullYear();

  return `${dayOfWeek}, ${day}${getOrdinalSuffix(day)} ${month} ${year}`;
}

function formatDate(event: Event): string {
  const startDate = event.startDate || event.start_date || event.date;
  const endDate = event.endDate || event.end_date;

  if (!startDate) return 'Date TBA';

  if (endDate && endDate !== startDate) {
    const start = new Date(startDate);
    const end = new Date(endDate);
    const startDay = start.getDate();
    const endDay = end.getDate();
    const startMonth = start.toLocaleDateString('en-GB', { month: 'short' });
    const endMonth = end.toLocaleDateString('en-GB', { month: 'short' });
    const year = start.getFullYear();

    // Same month: "7th - 9th Feb 2026"
    if (startMonth === endMonth) {
      return `${startDay}${getOrdinalSuffix(startDay)} - ${endDay}${getOrdinalSuffix(endDay)} ${startMonth} ${year}`;
    }
    // Different months: "28th Jan - 2nd Feb 2026"
    return `${startDay}${getOrdinalSuffix(startDay)} ${startMonth} - ${endDay}${getOrdinalSuffix(endDay)} ${endMonth} ${year}`;
  }

  return formatSingleDate(startDate);
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

  const filteredEvents = events.filter(event => {
    const startDateStr = event.startDate || event.start_date || event.date;
    if (!startDateStr) return false;

    // Parse the date string (assuming YYYY-MM-DD format)
    const eventDate = new Date(startDateStr);

    return eventDate.getFullYear() === currentYear &&
           eventDate.getMonth() === currentMonth;
  });

  // Sort by start date ascending (earliest first)
  return filteredEvents.sort((a, b) => {
    const dateA = a.startDate || a.start_date || a.date || '';
    const dateB = b.startDate || b.start_date || b.date || '';

    if (dateA < dateB) return -1;
    if (dateA > dateB) return 1;
    return 0;
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

  // Sort events within each month by start date ascending
  monthMap.forEach((monthEvents) => {
    monthEvents.sort((a, b) => {
      const dateA = a.startDate || a.start_date || a.date || '';
      const dateB = b.startDate || b.start_date || b.date || '';
      if (dateA < dateB) return -1;
      if (dateA > dateB) return 1;
      return 0;
    });
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
      <a href="${pathPrefix}" class="nav-link ${activePage === 'events' ? 'active' : ''}">
        🚂 Events
      </a>
      <a href="${pathPrefix}shops/" class="nav-link ${activePage === 'shops' ? 'active' : ''}">
        🏪 Shops
      </a>
      <a href="${pathPrefix}layouts/" class="nav-link ${activePage === 'layouts' ? 'active' : ''}">
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
  const pathPrefix = isCountyPage ? '../../' : '';
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

    .event-stats {
      display: flex;
      gap: 8px;
      margin-bottom: 12px;
      flex-wrap: wrap;
    }

    .stat-pill {
      display: inline-flex;
      align-items: center;
      padding: 4px 12px;
      border-radius: 12px;
      font-size: 0.85rem;
      font-weight: 600;
      background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
      color: white;
      cursor: help;
      position: relative;
    }

    .stat-pill::after {
      content: attr(data-tooltip);
      position: absolute;
      bottom: 100%;
      left: 50%;
      transform: translateX(-50%) translateY(-8px);
      background: rgba(0, 0, 0, 0.9);
      color: white;
      padding: 6px 12px;
      border-radius: 6px;
      font-size: 0.8rem;
      white-space: nowrap;
      opacity: 0;
      pointer-events: none;
      transition: opacity 0.2s, transform 0.2s;
      z-index: 1000;
    }

    .stat-pill:hover::after {
      opacity: 1;
      transform: translateX(-50%) translateY(-4px);
    }

    /* Add to Calendar Dropdown Styles */
    .add-to-calendar {
      position: relative;
      display: inline-block;
    }

    .add-to-calendar-btn {
      color: #667eea;
      text-decoration: none;
      font-weight: 600;
      font-size: 0.85rem;
      cursor: pointer;
      background: none;
      border: none;
      padding: 0;
      font-family: inherit;
      display: inline-flex;
      align-items: center;
      gap: 4px;
    }

    .add-to-calendar-btn:hover {
      text-decoration: underline;
    }

    .calendar-dropdown {
      display: none;
      position: absolute;
      top: 100%;
      left: 0;
      margin-top: 5px;
      background: white;
      border: 2px solid #667eea;
      border-radius: 8px;
      box-shadow: 0 4px 12px rgba(0, 0, 0, 0.15);
      z-index: 100;
      min-width: 180px;
    }

    .calendar-dropdown.active {
      display: block;
    }

    .calendar-dropdown-item {
      display: block;
      padding: 10px 15px;
      color: #333;
      text-decoration: none;
      font-size: 0.9rem;
      transition: background 0.2s;
      border-bottom: 1px solid #f0f0f0;
    }

    .calendar-dropdown-item:first-child {
      border-radius: 6px 6px 0 0;
    }

    .calendar-dropdown-item:last-child {
      border-bottom: none;
      border-radius: 0 0 6px 6px;
    }

    .calendar-dropdown-item:hover {
      background: #f5f5f5;
      color: #667eea;
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
        <a href="../${slugify(selectedCounty!)}.ics" download="${selectedCounty} Events.ics" class="calendar-btn">
          📅 Add to Calendar
        </a>
        ` : ''}
      </div>
    </header>

    ${generateNavigation('events', pathPrefix)}

    <div class="filter-section">
      <h3 class="filter-title">Filter by County</h3>
      <div class="filter-buttons">
        <a href="${isCountyPage ? '../../' : '/'}" class="filter-btn ${!isCountyPage ? 'active' : ''}" style="text-decoration: none;">
          All Counties (${Array.from(countyMap.values()).reduce((a, b) => a + b, 0)})
        </a>
        ${Array.from(countyMap.entries())
          .map(([county, count]) => {
            const isActive = selectedCounty === county;
            const slug = slugify(county);
            return `
        <a href="${isCountyPage ? '../' : 'events/'}${slug}/" class="filter-btn ${isActive ? 'active' : ''}" style="text-decoration: none;">
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
        <a href="${isCountyPage ? '../../calendar/' : 'calendar/'}" class="calendar-btn" style="margin-left: auto; text-decoration: none;">
          📅 View Calendar
        </a>
        <a href="${isCountyPage ? '../../map/' : 'map/'}" class="map-view-btn" style="text-decoration: none;">
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
          const eventSlug = slugify(event.name);
          const startDate = event.startDate || event.start_date || event.date;
          const icsPath = `${pathPrefix}ics/${eventSlug}-${startDate}.ics`;
          const googleUrl = generateGoogleCalendarUrl(event);
          const outlookUrl = generateOutlookUrl(event);
          return `
        <div class="this-month-event" data-county="${escapeHtml(county)}">
          <h3 class="this-month-event-name">${eventTitle}</h3>
          ${event.layouts || event.traders ? `<div class="event-stats">${event.layouts ? `<span class="stat-pill" data-tooltip="Layouts: ${event.layouts}">🚃 ${event.layouts}</span>` : ''}${event.traders ? `<span class="stat-pill" data-tooltip="Traders: ${event.traders}">🏪 ${event.traders}</span>` : ''}</div>` : ''}
          <div class="this-month-event-info">📅 ${formatDate(event)}</div>
          ${event.county ? `<div class="this-month-event-info">🏛️ ${escapeHtml(county)}</div>` : ''}
          ${event.venue ? `<div class="this-month-event-info">📍 ${escapeHtml(event.venue)}</div>` : ''}
          <div style="margin-top: 12px; display: flex; justify-content: space-between; align-items: center; gap: 10px; flex-wrap: wrap;">
            <div class="add-to-calendar">
              <button class="add-to-calendar-btn" onclick="toggleCalendarDropdown(event, this)">
                📥 Add to Calendar <span style="font-size: 0.7rem;">▼</span>
              </button>
              <div class="calendar-dropdown">
                <a href="${googleUrl}" target="_blank" rel="noopener noreferrer" class="calendar-dropdown-item">📅 Google Calendar</a>
                <a href="${outlookUrl}" target="_blank" rel="noopener noreferrer" class="calendar-dropdown-item">📧 Outlook</a>
                <a href="${icsPath}" download="${escapeHtml(event.name)}.ics" class="calendar-dropdown-item">🍎 Apple Calendar</a>
                <a href="${icsPath}" download="${escapeHtml(event.name)}.ics" class="calendar-dropdown-item">💾 Download ICS</a>
              </div>
            </div>
            ${event.url ? `
            <a href="${escapeHtml(event.url)}" target="_blank" rel="noopener noreferrer" style="color: #667eea; text-decoration: none; font-weight: 600; margin-left: auto;">
              More Info →
            </a>
            ` : ''}
          </div>
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
            const eventSlug = slugify(event.name);
            const startDate = event.startDate || event.start_date || event.date;
            const icsPath = `${pathPrefix}ics/${eventSlug}-${startDate}.ics`;
            const googleUrl = generateGoogleCalendarUrl(event);
            const outlookUrl = generateOutlookUrl(event);
            return `
          <div class="month-event" data-county="${escapeHtml(county)}">
            <h4 class="month-event-name">${eventTitle}</h4>
            ${event.layouts || event.traders ? `<div class="event-stats">${event.layouts ? `<span class="stat-pill" data-tooltip="Layouts: ${event.layouts}">🚃 ${event.layouts}</span>` : ''}${event.traders ? `<span class="stat-pill" data-tooltip="Traders: ${event.traders}">🏪 ${event.traders}</span>` : ''}</div>` : ''}
            <div class="month-event-info">📅 ${formatDate(event)}</div>
            ${event.county ? `<div class="month-event-info">🏛️ ${escapeHtml(county)}</div>` : ''}
            ${event.venue ? `<div class="month-event-info">📍 ${escapeHtml(event.venue)}</div>` : ''}
            <div style="margin-top: 10px; display: flex; justify-content: space-between; align-items: center; gap: 10px; flex-wrap: wrap;">
              <div class="add-to-calendar">
                <button class="add-to-calendar-btn" onclick="toggleCalendarDropdown(event, this)">
                  📥 Add to Calendar <span style="font-size: 0.7rem;">▼</span>
                </button>
                <div class="calendar-dropdown">
                  <a href="${googleUrl}" target="_blank" rel="noopener noreferrer" class="calendar-dropdown-item">📅 Google Calendar</a>
                  <a href="${outlookUrl}" target="_blank" rel="noopener noreferrer" class="calendar-dropdown-item">📧 Outlook</a>
                  <a href="${icsPath}" download="${escapeHtml(event.name)}.ics" class="calendar-dropdown-item">🍎 Apple Calendar</a>
                  <a href="${icsPath}" download="${escapeHtml(event.name)}.ics" class="calendar-dropdown-item">💾 Download ICS</a>
                </div>
              </div>
              ${event.url ? `
              <a href="${escapeHtml(event.url)}" target="_blank" rel="noopener noreferrer" style="color: #667eea; text-decoration: none; font-weight: 600; font-size: 0.85rem; margin-left: auto;">
                More Info →
              </a>
              ` : ''}
            </div>
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
      <p style="margin-top: 8px; font-size: 0.85rem;">
        <a href="https://github.com/railwaymodellingdirectory/railwaymodellingdirectorycom/wiki/Why-another-railway-modelling-directory%3F" target="_blank" rel="noopener noreferrer" style="color: #667eea; text-decoration: none;">
          About
        </a>
        <span style="color: #999; margin: 0 8px;">|</span>
        <a href="https://github.com/railwaymodellingdirectory" target="_blank" rel="noopener noreferrer" style="color: #667eea; text-decoration: none;">
          View on GitHub
        </a>
      </p>
    </footer>
  </div>

  <script>
    function toggleCalendarDropdown(event, button) {
      event.stopPropagation();
      const dropdown = button.nextElementSibling;
      const isActive = dropdown.classList.contains('active');

      // Close all dropdowns
      document.querySelectorAll('.calendar-dropdown').forEach(d => d.classList.remove('active'));

      // Toggle current dropdown
      if (!isActive) {
        dropdown.classList.add('active');
      }
    }

    // Close dropdowns when clicking outside
    document.addEventListener('click', function(e) {
      if (!e.target.closest('.add-to-calendar')) {
        document.querySelectorAll('.calendar-dropdown').forEach(d => d.classList.remove('active'));
      }
    });
  </script>
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

    ${generateNavigation(activePage, '../')}

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
      <p style="margin-top: 8px; font-size: 0.85rem;">
        <a href="https://github.com/railwaymodellingdirectory/railwaymodellingdirectorycom/wiki/Why-another-railway-modelling-directory%3F" target="_blank" rel="noopener noreferrer" style="color: #667eea; text-decoration: none;">
          About
        </a>
        <span style="color: #999; margin: 0 8px;">|</span>
        <a href="https://github.com/railwaymodellingdirectory" target="_blank" rel="noopener noreferrer" style="color: #667eea; text-decoration: none;">
          View on GitHub
        </a>
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
    url: event.url || '',
    latLng: (event as any).latLng || null
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
      <a href="../" class="back-link">← Back to Events</a>
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
        let lat, lon;

        // Check if event already has coordinates
        if (event.latLng) {
          // Handle string format "lat, lng"
          if (typeof event.latLng === 'string') {
            const parts = event.latLng.split(',').map(s => s.trim());
            if (parts.length === 2) {
              lat = parseFloat(parts[0]);
              lon = parseFloat(parts[1]);
              if (!isNaN(lat) && !isNaN(lon)) {
                console.log(\`Using existing coordinates for: \${event.name}\`);
              } else {
                lat = null;
                lon = null;
              }
            }
          }
          // Handle object format {lat: ..., lng: ...}
          else if (event.latLng.lat && event.latLng.lng) {
            lat = event.latLng.lat;
            lon = event.latLng.lng;
            console.log(\`Using existing coordinates for: \${event.name}\`);
          }
        }

        // Fall back to geocoding if no valid coordinates
        if (!lat || !lon) {
          // Fall back to geocoding
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

          if (!result) {
            console.warn(\`Could not geocode: \${event.name}\`);
            continue;
          }

          lat = parseFloat(result.lat);
          lon = parseFloat(result.lon);
        }

        if (lat && lon) {
          const marker = L.marker([lat, lon])
            .addTo(map)
            .bindPopup(createPopupContent(event));

          geocodedCount++;
          loadingEl.textContent = \`Loading map... (\${geocodedCount}/\${events.length})\`;
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

function generateCalendarPage(events: Event[]): string {
  const now = new Date();
  const currentMonth = now.getMonth();
  const currentYear = now.getFullYear();
  const monthName = getMonthName(currentMonth);

  // Group events by date
  const eventsByDate = new Map<string, Event[]>();
  events.forEach(event => {
    const startDateStr = event.startDate || event.start_date || event.date;
    if (!startDateStr) return;

    const endDateStr = event.endDate || event.end_date || startDateStr;
    const startDate = new Date(startDateStr);
    const endDate = new Date(endDateStr);

    // Add event to each date it spans
    const currentDate = new Date(startDate);
    while (currentDate <= endDate) {
      const dateKey = currentDate.toISOString().split('T')[0];
      if (!eventsByDate.has(dateKey)) {
        eventsByDate.set(dateKey, []);
      }
      eventsByDate.get(dateKey)!.push(event);
      currentDate.setDate(currentDate.getDate() + 1);
    }
  });

  const eventsJSON = JSON.stringify(Array.from(eventsByDate.entries()).map(([date, events]) => ({
    date,
    events: events.map(event => {
      const eventSlug = slugify(event.name);
      const startDate = event.startDate || event.start_date || event.date;
      const googleUrl = generateGoogleCalendarUrl(event);
      const outlookUrl = generateOutlookUrl(event);
      return {
        name: event.name,
        organizer: event.organizer || event.organiser || '',
        venue: event.venue || '',
        county: event.county || '',
        url: event.url || '',
        layouts: event.layouts || 0,
        traders: event.traders || 0,
        icsPath: `../ics/${eventSlug}-${startDate}.ics`,
        googleUrl,
        outlookUrl
      };
    })
  })));

  return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>This Month's Events - Calendar View</title>
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
      max-width: 1400px;
      margin: 0 auto;
    }

    header {
      background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
      color: white;
      padding: 20px 30px;
      border-radius: 12px;
      margin-bottom: 30px;
      box-shadow: 0 4px 6px rgba(0, 0, 0, 0.1);
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

    .calendar {
      background: white;
      border-radius: 10px;
      padding: 30px;
      box-shadow: 0 2px 8px rgba(0, 0, 0, 0.1);
    }

    .calendar-header {
      text-align: center;
      margin-bottom: 30px;
    }

    .calendar-title {
      font-size: 2rem;
      color: #667eea;
      font-weight: 700;
    }

    .calendar-grid {
      display: grid;
      grid-template-columns: repeat(7, 1fr);
      gap: 10px;
    }

    .calendar-day-header {
      text-align: center;
      font-weight: 700;
      color: #667eea;
      padding: 15px 10px;
      font-size: 0.9rem;
    }

    .calendar-day {
      min-height: 120px;
      border: 2px solid #e0e0e0;
      border-radius: 8px;
      padding: 10px;
      background: #fafafa;
      position: relative;
      transition: all 0.2s;
    }

    .calendar-day.empty {
      background: #f5f5f5;
      border-color: #f0f0f0;
    }

    .calendar-day.today {
      border-color: #667eea;
      background: rgba(102, 126, 234, 0.05);
    }

    .calendar-day.has-events {
      background: white;
      border-color: #667eea;
    }

    .calendar-day.has-events:hover {
      transform: translateY(-2px);
      box-shadow: 0 4px 12px rgba(102, 126, 234, 0.2);
    }

    .day-number {
      font-weight: 700;
      color: #333;
      margin-bottom: 8px;
      font-size: 1.1rem;
    }

    .calendar-day.today .day-number {
      color: #667eea;
    }

    .event-dot {
      width: 100%;
      padding: 6px 8px;
      margin-bottom: 4px;
      background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
      color: white;
      border-radius: 4px;
      font-size: 0.75rem;
      font-weight: 600;
      cursor: pointer;
      transition: all 0.2s;
      white-space: nowrap;
      overflow: hidden;
      text-overflow: ellipsis;
    }

    .event-dot:hover {
      transform: scale(1.02);
      box-shadow: 0 2px 6px rgba(102, 126, 234, 0.3);
    }

    .event-count {
      font-size: 0.7rem;
      color: #667eea;
      font-weight: 600;
      text-align: center;
      margin-top: 4px;
    }

    /* Modal Styles */
    .modal {
      display: none;
      position: fixed;
      z-index: 1000;
      left: 0;
      top: 0;
      width: 100%;
      height: 100%;
      background: rgba(0, 0, 0, 0.5);
      align-items: center;
      justify-content: center;
    }

    .modal.active {
      display: flex;
    }

    .modal-content {
      background: white;
      border-radius: 12px;
      padding: 30px;
      max-width: 600px;
      max-height: 80vh;
      overflow-y: auto;
      box-shadow: 0 8px 24px rgba(0, 0, 0, 0.2);
      position: relative;
    }

    .modal-close {
      position: absolute;
      top: 15px;
      right: 20px;
      font-size: 2rem;
      color: #999;
      cursor: pointer;
      border: none;
      background: none;
      line-height: 1;
    }

    .modal-close:hover {
      color: #667eea;
    }

    .modal-title {
      font-size: 1.5rem;
      color: #667eea;
      margin-bottom: 20px;
      padding-right: 30px;
    }

    .modal-event {
      padding: 15px;
      margin-bottom: 15px;
      border-left: 4px solid #667eea;
      background: #f9f9f9;
      border-radius: 4px;
    }

    .modal-event-name {
      font-weight: 700;
      color: #333;
      margin-bottom: 8px;
      font-size: 1.1rem;
    }

    .modal-event-info {
      font-size: 0.9rem;
      color: #666;
      margin-bottom: 4px;
    }

    .modal-event-link {
      display: inline-block;
      margin-top: 8px;
      color: #667eea;
      text-decoration: none;
      font-weight: 600;
    }

    .modal-event-link:hover {
      text-decoration: underline;
    }

    .event-stats {
      display: flex;
      gap: 8px;
      margin-top: 8px;
      flex-wrap: wrap;
    }

    .stat-pill {
      display: inline-flex;
      align-items: center;
      padding: 4px 10px;
      border-radius: 12px;
      font-size: 0.8rem;
      font-weight: 600;
      background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
      color: white;
    }

    /* Add to Calendar Dropdown Styles */
    .add-to-calendar {
      position: relative;
      display: inline-block;
    }

    .add-to-calendar-btn {
      color: #667eea;
      text-decoration: none;
      font-weight: 600;
      font-size: 0.9rem;
      cursor: pointer;
      background: none;
      border: none;
      padding: 0;
      font-family: inherit;
      display: inline-flex;
      align-items: center;
      gap: 4px;
    }

    .add-to-calendar-btn:hover {
      text-decoration: underline;
    }

    .calendar-dropdown-menu {
      display: none;
      position: absolute;
      top: 100%;
      left: 0;
      margin-top: 5px;
      background: white;
      border: 2px solid #667eea;
      border-radius: 8px;
      box-shadow: 0 4px 12px rgba(0, 0, 0, 0.15);
      z-index: 100;
      min-width: 180px;
    }

    .calendar-dropdown-menu.active {
      display: block;
    }

    .calendar-dropdown-item {
      display: block;
      padding: 10px 15px;
      color: #333;
      text-decoration: none;
      font-size: 0.9rem;
      transition: background 0.2s;
      border-bottom: 1px solid #f0f0f0;
    }

    .calendar-dropdown-item:first-child {
      border-radius: 6px 6px 0 0;
    }

    .calendar-dropdown-item:last-child {
      border-bottom: none;
      border-radius: 0 0 6px 6px;
    }

    .calendar-dropdown-item:hover {
      background: #f5f5f5;
      color: #667eea;
    }

    @media (max-width: 1024px) {
      .calendar-grid {
        gap: 5px;
      }

      .calendar-day {
        min-height: 100px;
        padding: 8px;
      }

      .event-dot {
        font-size: 0.7rem;
        padding: 4px 6px;
      }
    }

    @media (max-width: 768px) {
      h1 {
        font-size: 1.4rem;
      }

      .calendar {
        padding: 15px;
      }

      .calendar-title {
        font-size: 1.5rem;
      }

      .calendar-day-header {
        padding: 10px 5px;
        font-size: 0.8rem;
      }

      .calendar-day {
        min-height: 80px;
        padding: 5px;
      }

      .day-number {
        font-size: 0.9rem;
      }

      .event-dot {
        font-size: 0.65rem;
        padding: 3px 5px;
      }

      .modal-content {
        margin: 20px;
        padding: 20px;
      }
    }
  </style>
</head>
<body>
  <div class="container">
    <header>
      <h1>📅 ${monthName} ${currentYear} - Calendar View</h1>
      <a href="../" class="back-link">← Back to Events</a>
    </header>

    <div class="calendar">
      <div class="calendar-header">
        <h2 class="calendar-title">${monthName} ${currentYear}</h2>
      </div>
      <div class="calendar-grid" id="calendar">
        <!-- Calendar will be generated here -->
      </div>
    </div>
  </div>

  <div id="modal" class="modal">
    <div class="modal-content">
      <button class="modal-close" onclick="closeModal()">&times;</button>
      <div id="modal-body"></div>
    </div>
  </div>

  <script>
    const eventsData = ${eventsJSON};
    const eventsByDate = new Map(eventsData.map(item => [item.date, item.events]));

    function generateCalendar() {
      const now = new Date();
      const year = ${currentYear};
      const month = ${currentMonth};

      const firstDay = new Date(year, month, 1);
      const lastDay = new Date(year, month + 1, 0);
      const daysInMonth = lastDay.getDate();
      const startingDayOfWeek = firstDay.getDay();

      const calendar = document.getElementById('calendar');

      // Add day headers
      const dayNames = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];
      dayNames.forEach(day => {
        const header = document.createElement('div');
        header.className = 'calendar-day-header';
        header.textContent = day;
        calendar.appendChild(header);
      });

      // Add empty cells for days before the first day of the month
      for (let i = 0; i < startingDayOfWeek; i++) {
        const emptyDay = document.createElement('div');
        emptyDay.className = 'calendar-day empty';
        calendar.appendChild(emptyDay);
      }

      // Add days of the month
      for (let day = 1; day <= daysInMonth; day++) {
        const dateStr = \`\${year}-\${String(month + 1).padStart(2, '0')}-\${String(day).padStart(2, '0')}\`;
        const events = eventsByDate.get(dateStr) || [];

        const dayCell = document.createElement('div');
        dayCell.className = 'calendar-day';

        // Check if today
        const today = new Date();
        if (day === today.getDate() && month === today.getMonth() && year === today.getFullYear()) {
          dayCell.classList.add('today');
        }

        if (events.length > 0) {
          dayCell.classList.add('has-events');
        }

        const dayNumber = document.createElement('div');
        dayNumber.className = 'day-number';
        dayNumber.textContent = day;
        dayCell.appendChild(dayNumber);

        // Add event dots (max 3 visible)
        const maxVisible = 3;
        events.slice(0, maxVisible).forEach(event => {
          const eventDot = document.createElement('div');
          eventDot.className = 'event-dot';
          eventDot.textContent = event.name;
          eventDot.onclick = () => showEventModal(dateStr, events);
          dayCell.appendChild(eventDot);
        });

        // Show count if more events
        if (events.length > maxVisible) {
          const moreCount = document.createElement('div');
          moreCount.className = 'event-count';
          moreCount.textContent = \`+\${events.length - maxVisible} more\`;
          moreCount.onclick = () => showEventModal(dateStr, events);
          moreCount.style.cursor = 'pointer';
          dayCell.appendChild(moreCount);
        }

        calendar.appendChild(dayCell);
      }
    }

    function showEventModal(dateStr, events) {
      const modal = document.getElementById('modal');
      const modalBody = document.getElementById('modal-body');

      const date = new Date(dateStr + 'T12:00:00');
      const formattedDate = date.toLocaleDateString('en-GB', {
        weekday: 'long',
        day: 'numeric',
        month: 'long',
        year: 'numeric'
      });

      let html = \`<h2 class="modal-title">Events on \${formattedDate}</h2>\`;

      events.forEach(event => {
        const eventTitle = event.organizer
          ? \`\${event.name} by \${event.organizer}\`
          : event.name;

        html += \`
          <div class="modal-event">
            <div class="modal-event-name">\${eventTitle}</div>
            \${event.layouts || event.traders ? \`
              <div class="event-stats">
                \${event.layouts ? \`<span class="stat-pill">🚃 \${event.layouts} layouts</span>\` : ''}
                \${event.traders ? \`<span class="stat-pill">🏪 \${event.traders} traders</span>\` : ''}
              </div>
            \` : ''}
            \${event.county ? \`<div class="modal-event-info">🏛️ \${event.county}</div>\` : ''}
            \${event.venue ? \`<div class="modal-event-info">📍 \${event.venue}</div>\` : ''}
            <div style="margin-top: 10px; display: flex; gap: 15px; flex-wrap: wrap; align-items: center;">
              <div class="add-to-calendar">
                <button class="add-to-calendar-btn" onclick="toggleCalendarDropdown(event, this)">
                  📥 Add to Calendar <span style="font-size: 0.7rem;">▼</span>
                </button>
                <div class="calendar-dropdown-menu">
                  <a href="\${event.googleUrl}" target="_blank" rel="noopener noreferrer" class="calendar-dropdown-item">📅 Google Calendar</a>
                  <a href="\${event.outlookUrl}" target="_blank" rel="noopener noreferrer" class="calendar-dropdown-item">📧 Outlook</a>
                  <a href="\${event.icsPath}" download="\${event.name}.ics" class="calendar-dropdown-item">🍎 Apple Calendar</a>
                  <a href="\${event.icsPath}" download="\${event.name}.ics" class="calendar-dropdown-item">💾 Download ICS</a>
                </div>
              </div>
              \${event.url ? \`<a href="\${event.url}" target="_blank" rel="noopener noreferrer" class="modal-event-link">More Info →</a>\` : ''}
            </div>
          </div>
        \`;
      });

      modalBody.innerHTML = html;
      modal.classList.add('active');
    }

    function closeModal() {
      const modal = document.getElementById('modal');
      modal.classList.remove('active');
    }

    // Close modal when clicking outside
    document.getElementById('modal').addEventListener('click', function(e) {
      if (e.target === this) {
        closeModal();
      }
    });

    function toggleCalendarDropdown(event, button) {
      event.stopPropagation();
      const dropdown = button.nextElementSibling;
      const isActive = dropdown.classList.contains('active');

      // Close all dropdowns
      document.querySelectorAll('.calendar-dropdown-menu').forEach(d => d.classList.remove('active'));

      // Toggle current dropdown
      if (!isActive) {
        dropdown.classList.add('active');
      }
    }

    // Close dropdowns when clicking outside
    document.addEventListener('click', function(e) {
      if (!e.target.closest('.add-to-calendar')) {
        document.querySelectorAll('.calendar-dropdown-menu').forEach(d => d.classList.remove('active'));
      }
    });

    // Generate calendar on load
    generateCalendar();
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

function generateGoogleCalendarUrl(event: Event): string {
  const startDateStr = event.startDate || event.start_date || event.date;
  if (!startDateStr) return '';

  const endDateStr = event.endDate || event.end_date || startDateStr;
  const startDate = formatICSDate(startDateStr);

  // For all-day events, end date should be the day after
  const endDateObj = new Date(endDateStr);
  endDateObj.setDate(endDateObj.getDate() + 1);
  const endDate = formatICSDate(endDateObj.toISOString().split('T')[0]);

  const organizer = event.organizer || event.organiser || '';
  const eventTitle = organizer ? `${event.name} by ${organizer}` : event.name;
  const venue = event.venue || '';
  const county = event.county || '';
  const location = venue && county ? `${venue}, ${county}` : venue || county;

  const details = event.url ? `More info: ${event.url}` : '';

  const params = new URLSearchParams({
    action: 'TEMPLATE',
    text: eventTitle,
    dates: `${startDate}/${endDate}`,
    ...(details && { details }),
    ...(location && { location })
  });

  return `https://calendar.google.com/calendar/render?${params.toString()}`;
}

function generateOutlookUrl(event: Event): string {
  const startDateStr = event.startDate || event.start_date || event.date;
  if (!startDateStr) return '';

  const endDateStr = event.endDate || event.end_date || startDateStr;

  // Outlook expects ISO format with time
  const startDate = new Date(startDateStr + 'T00:00:00').toISOString();
  const endDateObj = new Date(endDateStr);
  endDateObj.setDate(endDateObj.getDate() + 1);
  const endDate = endDateObj.toISOString();

  const organizer = event.organizer || event.organiser || '';
  const eventTitle = organizer ? `${event.name} by ${organizer}` : event.name;
  const venue = event.venue || '';
  const county = event.county || '';
  const location = venue && county ? `${venue}, ${county}` : venue || county;

  const body = event.url ? `More info: ${event.url}` : '';

  const params = new URLSearchParams({
    subject: eventTitle,
    startdt: startDate,
    enddt: endDate,
    ...(body && { body }),
    ...(location && { location }),
    path: '/calendar/action/compose',
    rru: 'addevent'
  });

  return `https://outlook.live.com/calendar/0/deeplink/compose?${params.toString()}`;
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

function generateAllEventsICS(events: Event[]): string {
  const now = new Date();
  const timestamp = now.toISOString().replace(/[-:]/g, '').split('.')[0] + 'Z';

  let icsContent = `BEGIN:VCALENDAR
VERSION:2.0
PRODID:-//Railway Modelling Events//All Events Calendar//EN
CALSCALE:GREGORIAN
METHOD:PUBLISH
X-WR-CALNAME:Railway Modelling Events
X-WR-CALDESC:All upcoming railway modelling events in the UK
X-WR-TIMEZONE:Europe/London
REFRESH-INTERVAL;VALUE=DURATION:P1D
X-PUBLISHED-TTL:P1D
`;

  events.forEach((event) => {
    const startDateStr = event.startDate || event.start_date || event.date;
    if (!startDateStr) return;

    const endDateStr = event.endDate || event.end_date || startDateStr;
    const startDate = formatICSDate(startDateStr);

    const endDateObj = new Date(endDateStr);
    endDateObj.setDate(endDateObj.getDate() + 1);
    const endDatePlusOne = formatICSDate(endDateObj.toISOString().split('T')[0]);

    const organizer = event.organizer || event.organiser || '';
    const eventTitle = organizer ? `${event.name} by ${organizer}` : event.name;
    const venue = event.venue || '';
    const county = event.county || '';
    const location = venue && county ? `${venue}, ${county}` : venue || county;

    // Stable UID so calendar apps update events rather than duplicate them
    const uid = `${slugify(event.name)}-${startDate}@railwaymodellingevents.com`;

    icsContent += `BEGIN:VEVENT
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

function generateSingleEventICS(event: Event): string {
  const now = new Date();
  const timestamp = now.toISOString().replace(/[-:]/g, '').split('.')[0] + 'Z';

  const startDateStr = event.startDate || event.start_date || event.date;
  if (!startDateStr) return '';

  const endDateStr = event.endDate || event.end_date || startDateStr;
  const startDate = formatICSDate(startDateStr);

  // For all-day events, the end date should be the day AFTER the last day
  const endDateObj = new Date(endDateStr);
  endDateObj.setDate(endDateObj.getDate() + 1);
  const endDatePlusOne = formatICSDate(endDateObj.toISOString().split('T')[0]);

  const organizer = event.organizer || event.organiser || '';
  const eventTitle = organizer ? `${event.name} by ${organizer}` : event.name;
  const venue = event.venue || '';
  const county = event.county || '';
  const location = venue && county ? `${venue}, ${county}` : venue || county;

  const uid = `event-${slugify(event.name)}-${startDate}@railwaymodellingevents.com`;

  return `BEGIN:VCALENDAR
VERSION:2.0
PRODID:-//Railway Modelling Events//Events Calendar//EN
CALSCALE:GREGORIAN
METHOD:PUBLISH
X-WR-CALNAME:${escapeICS(eventTitle)}
X-WR-TIMEZONE:Europe/London
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
END:VCALENDAR
`;
}

async function build() {
  console.log('🚂 Building Railway Modelling Events website...\n');

  // Create dist directory
  if (!fs.existsSync(DIST_DIR)) {
    fs.mkdirSync(DIST_DIR, { recursive: true });
  }

  // Fetch events
  const events = await fetchEvents();

  // Filter out past events
  const upcomingEvents = filterUpcomingEvents(events);

  // Sort events by date (most recent first)
  const sortedEvents = sortEventsByDate(upcomingEvents);

  // Extract counties for filtering
  const countyMap = extractCounties(sortedEvents);

  // Filter events for current month
  const thisMonthEvents = filterEventsByCurrentMonth(sortedEvents);

  // Group events by month for 2026
  const monthlyEvents = groupEventsByMonth(sortedEvents, 2026);

  // Generate individual ICS files for each event
  console.log('Generating individual event calendar files...');
  const icsDir = path.join(DIST_DIR, 'ics');
  if (!fs.existsSync(icsDir)) {
    fs.mkdirSync(icsDir, { recursive: true });
  }

  sortedEvents.forEach((event) => {
    const icsContent = generateSingleEventICS(event);
    if (icsContent) {
      const eventSlug = slugify(event.name);
      const startDate = event.startDate || event.start_date || event.date;
      const icsFileName = `${eventSlug}-${startDate}.ics`;
      const icsPath = path.join(icsDir, icsFileName);
      fs.writeFileSync(icsPath, icsContent);
    }
  });
  console.log(`✓ Generated ${sortedEvents.length} individual event ICS files`);

  // Generate all-events subscription feed
  const allEventsICS = generateAllEventsICS(sortedEvents);
  const eventsICSDir = path.join(DIST_DIR, 'events');
  if (!fs.existsSync(eventsICSDir)) {
    fs.mkdirSync(eventsICSDir, { recursive: true });
  }
  fs.writeFileSync(path.join(eventsICSDir, 'calendar.ics'), allEventsICS);
  console.log('✓ Generated /events/calendar.ics subscription feed');;

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

    // Create county directory
    const countyDir = path.join(eventsDir, countySlug);
    if (!fs.existsSync(countyDir)) {
      fs.mkdirSync(countyDir, { recursive: true });
    }

    const countyPath = path.join(countyDir, 'index.html');
    fs.writeFileSync(countyPath, countyHTML);
    console.log(`✓ Generated ${countyPath}`);

    // Generate ICS file for county (in events directory, not county subdirectory)
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
  const shopsDir = path.join(DIST_DIR, 'shops');
  if (!fs.existsSync(shopsDir)) {
    fs.mkdirSync(shopsDir, { recursive: true });
  }
  const shopsPath = path.join(shopsDir, 'index.html');
  fs.writeFileSync(shopsPath, shopsHTML);
  console.log(`✓ Generated ${shopsPath}`);

  // Generate Layouts page
  const layoutsHTML = generateComingSoonPage(
    'Railway Modelling Layouts',
    '🚃',
    'We\'re creating a showcase of amazing railway modelling layouts from across the UK. Stay tuned for inspiration and ideas!',
    'layouts'
  );
  const layoutsDir = path.join(DIST_DIR, 'layouts');
  if (!fs.existsSync(layoutsDir)) {
    fs.mkdirSync(layoutsDir, { recursive: true });
  }
  const layoutsPath = path.join(layoutsDir, 'index.html');
  fs.writeFileSync(layoutsPath, layoutsHTML);
  console.log(`✓ Generated ${layoutsPath}`);

  // Generate Map page for this month's events
  const mapHTML = generateMapPage(thisMonthEvents);
  const mapDir = path.join(DIST_DIR, 'map');
  if (!fs.existsSync(mapDir)) {
    fs.mkdirSync(mapDir, { recursive: true });
  }
  const mapPath = path.join(mapDir, 'index.html');
  fs.writeFileSync(mapPath, mapHTML);
  console.log(`✓ Generated ${mapPath}`);

  // Generate Calendar page for this month's events
  const calendarHTML = generateCalendarPage(thisMonthEvents);
  const calendarDir = path.join(DIST_DIR, 'calendar');
  if (!fs.existsSync(calendarDir)) {
    fs.mkdirSync(calendarDir, { recursive: true });
  }
  const calendarPath = path.join(calendarDir, 'index.html');
  fs.writeFileSync(calendarPath, calendarHTML);
  console.log(`✓ Generated ${calendarPath}`);

  console.log('\n✨ Build complete!');
  console.log(`\nTo view the site:`);
  console.log(`  1. Open ${eventsPath} in your browser`);
  console.log(`  2. Or run: npx serve dist`);
}

build().catch(error => {
  console.error('Build failed:', error);
  process.exit(1);
});
