export const DateHelper = {
  isoNow: (): string => new Date().toISOString(),
  addDays(days: number, from: Date = new Date()): Date {
    const d = new Date(from);
    d.setDate(d.getDate() + days);
    return d;
  },
  timestamp: (): string => new Date().toISOString().replace(/[:.]/g, '-'),
};
