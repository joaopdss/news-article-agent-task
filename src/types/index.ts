export interface Article {
  title: string;
  content: string;
  url: string;
  date: string; // Format: 'YYYY-MM-DD'
}

export interface QueryPayload {
  query: string;
}

export interface Source {
  title: string;
  url: string;
  date: string; // ISO format or YYYY-MM-DD
  content?: string; // Make content optional
}

export interface ApiResponse {
  answer: string;
  sources: Source[];
} 