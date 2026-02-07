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

function generateHTML(events: Event[], countyMap: Map<string, number>): string {
  const eventsHTML = events
    .map(event => {
      const county = event.county || 'Not Specified';
      return `
      <div class="event-card" data-county="${escapeHtml(county)}">
        <h2 class="event-name">${escapeHtml(event.name)}</h2>
        <div class="event-details">
          <div class="event-date">
            <strong>📅 Date:</strong> ${formatDate(event)}
          </div>
          <div class="event-county">
            <strong>🏛️ County:</strong> ${escapeHtml(county)}
          </div>
          ${event.venue ? `
          <div class="event-venue">
            <strong>📍 Venue:</strong> ${escapeHtml(event.venue)}
          </div>
          ` : ''}
          ${event.location ? `
          <div class="event-location">
            <strong>🗺️ Location:</strong> ${escapeHtml(event.location)}
          </div>
          ` : ''}
          ${event.organiser ? `
          <div class="event-organiser">
            <strong>👤 Organiser:</strong> ${escapeHtml(event.organiser)}
          </div>
          ` : ''}
        </div>
        ${event.description ? `
        <div class="event-description">
          ${escapeHtml(event.description)}
        </div>
        ` : ''}
        ${event.url ? `
        <div class="event-link">
          <a href="${escapeHtml(event.url)}" target="_blank" rel="noopener noreferrer">
            More Information →
          </a>
        </div>
        ` : ''}
      </div>
    `;
    })
    .join('\n');

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
      display: inline-block;
      padding: 8px 16px;
      border-radius: 20px;
      margin-top: 15px;
      font-weight: 500;
    }

    .events-grid {
      display: grid;
      grid-template-columns: repeat(auto-fill, minmax(350px, 1fr));
      gap: 25px;
      margin-bottom: 40px;
    }

    .event-card {
      background: white;
      border-radius: 10px;
      padding: 25px;
      box-shadow: 0 2px 8px rgba(0, 0, 0, 0.1);
      transition: transform 0.2s, box-shadow 0.2s;
    }

    .event-card:hover {
      transform: translateY(-4px);
      box-shadow: 0 4px 16px rgba(0, 0, 0, 0.15);
    }

    .event-name {
      color: #667eea;
      font-size: 1.5rem;
      margin-bottom: 15px;
      line-height: 1.3;
    }

    .event-details {
      margin-bottom: 15px;
    }

    .event-details > div {
      margin-bottom: 8px;
      padding: 6px 0;
      border-bottom: 1px solid #f0f0f0;
    }

    .event-details > div:last-child {
      border-bottom: none;
    }

    .event-details strong {
      color: #555;
      margin-right: 8px;
    }

    .event-description {
      color: #666;
      margin: 15px 0;
      padding: 12px;
      background: #f9f9f9;
      border-radius: 6px;
      font-size: 0.95rem;
    }

    .event-link {
      margin-top: 15px;
      padding-top: 15px;
      border-top: 2px solid #f0f0f0;
    }

    .event-link a {
      display: inline-block;
      color: #667eea;
      text-decoration: none;
      font-weight: 600;
      transition: color 0.2s;
    }

    .event-link a:hover {
      color: #764ba2;
    }

    footer {
      text-align: center;
      padding: 20px;
      color: #666;
      font-size: 0.9rem;
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

    .event-card.hidden {
      display: none;
    }

    .event-county {
      margin-bottom: 8px;
      padding: 6px 0;
      border-bottom: 1px solid #f0f0f0;
    }

    @media (max-width: 768px) {
      .events-grid {
        grid-template-columns: 1fr;
      }

      h1 {
        font-size: 2rem;
      }

      header {
        padding: 30px 20px;
      }

      .filter-section {
        padding: 20px 15px;
      }

      .filter-buttons {
        gap: 8px;
      }

      .filter-btn {
        font-size: 0.9rem;
        padding: 8px 16px;
      }
    }
  </style>
</head>
<body>
  <div class="container">
    <header>
      <h1>🚂 Railway Modelling Events</h1>
      <p class="subtitle">Discover upcoming railway modelling events across the UK</p>
      <div class="events-count">${events.length} Events Listed</div>
    </header>

    <div class="filter-section">
      <h3 class="filter-title">Filter by County</h3>
      <div class="filter-buttons">
        <button class="filter-btn active" data-county="all">
          All Counties (${events.length})
        </button>
        ${Array.from(countyMap.entries())
          .map(([county, count]) => `
        <button class="filter-btn" data-county="${escapeHtml(county)}">
          ${escapeHtml(county)} (${count})
        </button>
          `)
          .join('')}
      </div>
      <div class="active-filter-display">
        Showing <strong id="visible-count">${events.length}</strong> of ${events.length} events
      </div>
    </div>

    <main>
      <div class="events-grid">
        ${eventsHTML}
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

  <script>
    // County filtering functionality
    (function() {
      const filterButtons = document.querySelectorAll('.filter-btn');
      const eventCards = document.querySelectorAll('.event-card');
      const visibleCountEl = document.getElementById('visible-count');

      function filterEvents(selectedCounty) {
        let visibleCount = 0;

        eventCards.forEach(card => {
          const cardCounty = card.getAttribute('data-county');

          if (selectedCounty === 'all' || cardCounty === selectedCounty) {
            card.classList.remove('hidden');
            visibleCount++;
          } else {
            card.classList.add('hidden');
          }
        });

        // Update visible count
        if (visibleCountEl) {
          visibleCountEl.textContent = visibleCount;
        }

        // Update active button state
        filterButtons.forEach(btn => {
          const btnCounty = btn.getAttribute('data-county');
          if (btnCounty === selectedCounty) {
            btn.classList.add('active');
          } else {
            btn.classList.remove('active');
          }
        });
      }

      // Add click handlers to filter buttons
      filterButtons.forEach(button => {
        button.addEventListener('click', () => {
          const county = button.getAttribute('data-county');
          filterEvents(county);
        });
      });

      // Initialize with all events visible
      filterEvents('all');
    })();
  </script>
</body>
</html>`;
}

function escapeHtml(unsafe: string): string {
  return unsafe
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#039;");
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

  // Generate HTML
  console.log('Generating HTML...');
  const html = generateHTML(sortedEvents, countyMap);

  // Write to file
  const outputPath = path.join(DIST_DIR, 'index.html');
  fs.writeFileSync(outputPath, html);
  console.log(`✓ Generated ${outputPath}`);

  console.log('\n✨ Build complete!');
  console.log(`\nTo view the site:`);
  console.log(`  1. Open ${outputPath} in your browser`);
  console.log(`  2. Or run: npx serve dist`);
}

build().catch(error => {
  console.error('Build failed:', error);
  process.exit(1);
});
