export interface ObservationHistoryEntry {
  raw: string;
  author: string;
  timestamp: string | null;
  message: string;
  isStructured: boolean;
}

const STRUCTURED_OBSERVATION_PATTERN =
  /^(.*?)\s+-\s+(\d{2}\/\d{2}\/\d{4}\s+\d{2}:\d{2})\s+-\s+(.+)$/;

export function getObservationLines(
  value: string | null | undefined,
): string[] {
  if (!value) {
    return [];
  }

  return value
    .replace(/\r\n?/g, '\n')
    .split('\n')
    .map((line) => line.trim())
    .filter(Boolean);
}

export function parseObservationHistory(
  value: string | null | undefined,
): ObservationHistoryEntry[] {
  return getObservationLines(value).map((raw) => {
    const match = raw.match(STRUCTURED_OBSERVATION_PATTERN);

    if (!match) {
      return {
        raw,
        author: 'Registo anterior',
        timestamp: null,
        message: raw,
        isStructured: false,
      };
    }

    return {
      raw,
      author: match[1].trim() || 'Utilizador',
      timestamp: match[2],
      message: match[3].trim(),
      isStructured: true,
    };
  });
}

export function normalizeObservationDraft(value: string): string {
  return value
    .replace(/\r\n?/g, '\n')
    .split('\n')
    .map((line) => line.trim())
    .filter(Boolean)
    .join(' ')
    .replace(/\s{2,}/g, ' ')
    .trim();
}

export function formatObservationTimestamp(date: Date): string {
  const day = String(date.getDate()).padStart(2, '0');
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const year = date.getFullYear();
  const hours = String(date.getHours()).padStart(2, '0');
  const minutes = String(date.getMinutes()).padStart(2, '0');

  return `${day}/${month}/${year} ${hours}:${minutes}`;
}

export function appendObservationHistory(
  currentValue: string | null | undefined,
  draftValue: string,
  author: string,
  now = new Date(),
): string | null {
  const draft = normalizeObservationDraft(draftValue);

  if (!draft) {
    return null;
  }

  const history = getObservationLines(currentValue).join('\n');
  const safeAuthor = author.trim() || 'Utilizador';
  const entry = `${safeAuthor} - ${formatObservationTimestamp(now)} - ${draft}`;

  return history ? `${history}\n${entry}` : entry;
}
