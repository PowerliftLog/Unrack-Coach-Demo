export function localToday(now = new Date()): string {
  return `${String(now.getFullYear()).padStart(4, '0')}-${String(now.getMonth() + 1).padStart(2, '0')}-${String(now.getDate()).padStart(2, '0')}`
}

const shortDateFormatter = new Intl.DateTimeFormat('en-US', { month: 'short', day: 'numeric' })

export function shortDate(iso: string): string {
  return shortDateFormatter.format(new Date(`${iso}T12:00:00`))
}
