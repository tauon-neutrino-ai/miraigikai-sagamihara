/** 会議を新しい順に並べるための値。「9月定例会議」なら会議名の月を、臨時会議などは開会日の月を使う */
export function sessionSortKey(s: { year: number; name: string; start_date?: string | null }): number {
  const m = s.name.match(/(\d{1,2})月/);
  const month = m ? Number(m[1]) : s.start_date ? Number(s.start_date.slice(5, 7)) : 0;
  return s.year * 100 + month;
}

export function sortSessionsDesc<T extends { year: number; name: string; start_date?: string | null }>(list: T[]): T[] {
  return [...list].sort((a, b) => sessionSortKey(b) - sessionSortKey(a));
}
