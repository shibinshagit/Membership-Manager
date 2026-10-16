export function cleanDisplayName(value: unknown): string | null {
  if (value == null) return null;
  const text = String(value).trim();
  if (!text || text.toLowerCase() === 'null' || text.toLowerCase() === 'undefined') return null;
  return text;
}

export function memberDisplayName(person: {
  full_name?: string | null;
  display_name?: string | null;
}): string {
  return cleanDisplayName(person.display_name) || person.full_name?.trim() || '';
}
