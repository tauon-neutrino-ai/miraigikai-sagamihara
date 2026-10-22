type SessionLike = { year: number; name: string; start_date?: string | null; decided_on?: string | null };

/**
 * 会議を新しい順に並べるための値。「9月定例会議」なら会議名の月を、
 * 臨時会議などは開会日（なければ議案の議決日）の月を使う
 */
export function sessionSortKey(s: SessionLike): number {
  const m = s.name.match(/(\d{1,2})月/);
  const date = s.start_date ?? s.decided_on;
  const month = m ? Number(m[1]) : date ? Number(date.slice(5, 7)) : 0;
  return s.year * 100 + month;
}

export function sortSessionsDesc<T extends SessionLike>(list: T[]): T[] {
  return [...list].sort((a, b) => sessionSortKey(b) - sessionSortKey(a));
}
