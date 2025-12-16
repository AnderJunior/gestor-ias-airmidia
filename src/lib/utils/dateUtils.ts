// Utilitários de data em JavaScript nativo para substituir date-fns

export function format(date: Date, formatStr: string, options?: { locale?: any }): string {
  const day = date.getDate()
  const month = date.getMonth()
  const year = date.getFullYear()
  const hours = date.getHours()
  const minutes = date.getMinutes()
  
  // Verificar se o locale é ptBR (objeto que criamos)
  const isPtBR = options?.locale === ptBR || (options?.locale && options.locale.localize)
  
  const monthNames = isPtBR
    ? ['janeiro', 'fevereiro', 'março', 'abril', 'maio', 'junho', 'julho', 'agosto', 'setembro', 'outubro', 'novembro', 'dezembro']
    : ['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December']
  
  const monthNamesShort = isPtBR
    ? ['jan', 'fev', 'mar', 'abr', 'mai', 'jun', 'jul', 'ago', 'set', 'out', 'nov', 'dez']
    : ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec']
  
  const dayNames = isPtBR
    ? ['domingo', 'segunda-feira', 'terça-feira', 'quarta-feira', 'quinta-feira', 'sexta-feira', 'sábado']
    : ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday']
  
  const dayNamesShort = isPtBR
    ? ['Dom', 'Seg', 'Ter', 'Qua', 'Qui', 'Sex', 'Sáb']
    : ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat']
  
  let result = formatStr
  
  // d - dia do mês (1-31)
  result = result.replace(/\bd\b/g, day.toString())
  // dd - dia do mês com zero à esquerda (01-31)
  result = result.replace(/\bdd\b/g, day.toString().padStart(2, '0'))
  
  // M - mês (1-12)
  result = result.replace(/\bM\b/g, (month + 1).toString())
  // MM - mês com zero à esquerda (01-12)
  result = result.replace(/\bMM\b/g, (month + 1).toString().padStart(2, '0'))
  // MMM - mês abreviado
  result = result.replace(/\bMMM\b/g, monthNamesShort[month])
  // MMMM - mês completo
  result = result.replace(/\bMMMM\b/g, monthNames[month])
  
  // yyyy - ano completo
  result = result.replace(/\byyyy\b/g, year.toString())
  // yy - ano com 2 dígitos
  result = result.replace(/\byy\b/g, year.toString().slice(-2))
  
  // HH - hora 24h com zero à esquerda
  result = result.replace(/\bHH\b/g, hours.toString().padStart(2, '0'))
  // H - hora 24h
  result = result.replace(/\bH\b/g, hours.toString())
  // mm - minutos com zero à esquerda
  result = result.replace(/\bmm\b/g, minutes.toString().padStart(2, '0'))
  // HH:mm
  result = result.replace(/\bHH:mm\b/g, `${hours.toString().padStart(2, '0')}:${minutes.toString().padStart(2, '0')}`)
  
  // EEE - dia da semana abreviado
  result = result.replace(/\bEEE\b/g, dayNamesShort[date.getDay()])
  // EEEE - dia da semana completo
  result = result.replace(/\bEEEE\b/g, dayNames[date.getDay()])
  
  // Formato especial: "EEEE, d 'de' MMMM 'de' yyyy"
  result = result.replace(/EEEE, d 'de' MMMM 'de' yyyy/, `${dayNames[date.getDay()]}, ${day} de ${monthNames[month]} de ${year}`)
  
  return result
}

export function startOfMonth(date: Date): Date {
  return new Date(date.getFullYear(), date.getMonth(), 1)
}

export function endOfMonth(date: Date): Date {
  return new Date(date.getFullYear(), date.getMonth() + 1, 0)
}

export function startOfWeek(date: Date, options?: { weekStartsOn?: number }): Date {
  const weekStartsOn = options?.weekStartsOn ?? 0 // 0 = domingo, 1 = segunda
  const day = date.getDay()
  const diff = day < weekStartsOn ? day + 7 - weekStartsOn : day - weekStartsOn
  const result = new Date(date)
  result.setDate(date.getDate() - diff)
  result.setHours(0, 0, 0, 0)
  return result
}

export function endOfWeek(date: Date, options?: { weekStartsOn?: number }): Date {
  const weekStartsOn = options?.weekStartsOn ?? 0
  const start = startOfWeek(date, options)
  const result = new Date(start)
  result.setDate(start.getDate() + 6)
  result.setHours(23, 59, 59, 999)
  return result
}

export function startOfDay(date: Date): Date {
  const result = new Date(date)
  result.setHours(0, 0, 0, 0)
  return result
}

export function eachDayOfInterval(interval: { start: Date; end: Date }): Date[] {
  const days: Date[] = []
  const current = new Date(interval.start)
  current.setHours(0, 0, 0, 0)
  const end = new Date(interval.end)
  end.setHours(0, 0, 0, 0)
  
  while (current <= end) {
    days.push(new Date(current))
    current.setDate(current.getDate() + 1)
  }
  
  return days
}

export function eachWeekOfInterval(interval: { start: Date; end: Date }, options?: { weekStartsOn?: number }): Date[] {
  const weeks: Date[] = []
  const current = startOfWeek(interval.start, options)
  const end = new Date(interval.end)
  
  while (current <= end) {
    weeks.push(new Date(current))
    current.setDate(current.getDate() + 7)
  }
  
  return weeks
}

export function isSameDay(date1: Date, date2: Date): boolean {
  return date1.getFullYear() === date2.getFullYear() &&
         date1.getMonth() === date2.getMonth() &&
         date1.getDate() === date2.getDate()
}

export function isSameMonth(date1: Date, date2: Date): boolean {
  return date1.getFullYear() === date2.getFullYear() &&
         date1.getMonth() === date2.getMonth()
}

export function isWithinInterval(date: Date, interval: { start: Date; end: Date }): boolean {
  return date >= interval.start && date <= interval.end
}

export function addMonths(date: Date, amount: number): Date {
  const result = new Date(date)
  result.setMonth(date.getMonth() + amount)
  return result
}

export function subMonths(date: Date, amount: number): Date {
  return addMonths(date, -amount)
}

export function addHours(date: Date, amount: number): Date {
  const result = new Date(date)
  result.setHours(date.getHours() + amount)
  return result
}

// Locale pt-BR simulado
export const ptBR = {
  localize: {
    month: (n: number) => {
      const months = ['janeiro', 'fevereiro', 'março', 'abril', 'maio', 'junho', 'julho', 'agosto', 'setembro', 'outubro', 'novembro', 'dezembro']
      return months[n]
    },
    day: (n: number) => {
      const days = ['domingo', 'segunda-feira', 'terça-feira', 'quarta-feira', 'quinta-feira', 'sexta-feira', 'sábado']
      return days[n]
    }
  }
}

