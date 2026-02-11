export interface Event {
  name: string;
  date?: string;
  start_date?: string;
  end_date?: string;
  startDate?: string;
  endDate?: string;
  location?: string;
  venue?: string;
  description?: string;
  url?: string;
  organiser?: string;
  organizer?: string;
  county?: string;
  layouts?: number | string;
  traders?: number | string;
  [key: string]: unknown;
}

export interface EventsData {
  events?: Event[];
  [key: string]: unknown;
}
