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
  county?: string;
  [key: string]: unknown;
}

export interface EventsData {
  events?: Event[];
  [key: string]: unknown;
}
