/** Telegram-HTML дайджеста (только <b>/<i>) → безопасный HTML для страницы. */
export function digestToHtml(content: string): string {
  const escaped = content
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;");
  return escaped
    .replaceAll("&lt;b&gt;", "<b>")
    .replaceAll("&lt;/b&gt;", "</b>")
    .replaceAll("&lt;i&gt;", "<i>")
    .replaceAll("&lt;/i&gt;", "</i>")
    .replaceAll("\n", "<br/>");
}

const dateFmt = new Intl.DateTimeFormat("ru-RU", { day: "numeric", month: "long", year: "numeric" });

export function formatDateRu(isoDate: string): string {
  return dateFmt.format(new Date(`${isoDate}T00:00:00`));
}

/** Оборот в читаемом виде: 1,2 млрд ₽ / 340 млн ₽ / 870 тыс ₽. */
export function formatTurnover(valueRub: number): string {
  if (valueRub >= 1e9) return `${(valueRub / 1e9).toLocaleString("ru-RU", { maximumFractionDigits: 1 })} млрд ₽`;
  if (valueRub >= 1e6) return `${(valueRub / 1e6).toLocaleString("ru-RU", { maximumFractionDigits: 0 })} млн ₽`;
  return `${(valueRub / 1e3).toLocaleString("ru-RU", { maximumFractionDigits: 0 })} тыс ₽`;
}

export function formatPct(value: number | null): string {
  if (value === null) return "";
  const sign = value > 0 ? "+" : "";
  return `${sign}${value.toFixed(2)}%`;
}
