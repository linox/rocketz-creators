export type CalendarCell = {
  dateStr: string;
  dayNumber: number;
  isCurrentMonth: boolean;
};

export function localDateStr(date = new Date()) {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}

export function toDateKey(value?: string | null) {
  if (!value) return "";
  return value.slice(0, 10);
}

export function getCalendarDays(selectedMonth: string): CalendarCell[] {
  const [yearStr, monthStr] = selectedMonth.split("-");
  const year = Number(yearStr);
  const monthIndex = Number(monthStr) - 1;
  const firstDay = new Date(year, monthIndex, 1);
  const lastDay = new Date(year, monthIndex + 1, 0);
  const startWeek = (firstDay.getDay() + 6) % 7;
  const daysInMonth = lastDay.getDate();
  const grid: CalendarCell[] = [];

  const prevLast = new Date(year, monthIndex, 0).getDate();
  for (let i = startWeek - 1; i >= 0; i -= 1) {
    const day = prevLast - i;
    const prevM = monthIndex === 0 ? 12 : monthIndex;
    const prevY = monthIndex === 0 ? year - 1 : year;
    grid.push({ dateStr: `${prevY}-${String(prevM).padStart(2, "0")}-${String(day).padStart(2, "0")}`, dayNumber: day, isCurrentMonth: false });
  }
  for (let day = 1; day <= daysInMonth; day += 1) {
    grid.push({ dateStr: `${year}-${String(monthIndex + 1).padStart(2, "0")}-${String(day).padStart(2, "0")}`, dayNumber: day, isCurrentMonth: true });
  }
  const remaining = grid.length <= 35 ? 35 - grid.length : 42 - grid.length;
  for (let day = 1; day <= remaining; day += 1) {
    const nextM = monthIndex === 11 ? 1 : monthIndex + 2;
    const nextY = monthIndex === 11 ? year + 1 : year;
    grid.push({ dateStr: `${nextY}-${String(nextM).padStart(2, "0")}-${String(day).padStart(2, "0")}`, dayNumber: day, isCurrentMonth: false });
  }
  return grid;
}
