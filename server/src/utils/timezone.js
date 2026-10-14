// Time-zone-aware day boundaries. APP_TIMEZONE e.g. Asia/Dhaka, defaults to UTC.
function appTimeZone() {
  return process.env.APP_TIMEZONE || "UTC";
}

function tzOffsetMs(date, timeZone) {
  const dtf = new Intl.DateTimeFormat("en-US", {
    timeZone,
    hour12: false,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
  });
  const parts = Object.fromEntries(dtf.formatToParts(date).map((p) => [p.type, p.value]));
  const asUTC = Date.UTC(
    Number(parts.year),
    Number(parts.month) - 1,
    Number(parts.day),
    Number(parts.hour) % 24,
    Number(parts.minute),
    Number(parts.second)
  );
  return asUTC - date.getTime();
}

function ymdInTZ(date, timeZone) {
  const dtf = new Intl.DateTimeFormat("en-CA", {
    timeZone,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  });
  const [y, m, d] = dtf.format(date).split("-").map(Number);
  return { y, m, d };
}

// End of the calendar day (23:59:59.999) in the configured zone, as a UTC instant.
function endOfDayInTZ(date, timeZone = appTimeZone()) {
  const { y, m, d } = ymdInTZ(date, timeZone);
  const guess = Date.UTC(y, m - 1, d + 1, 0, 0, 0, 0);
  const offset = tzOffsetMs(new Date(guess), timeZone);
  return new Date(guess - offset - 1);
}

function startOfDayInTZ(date, timeZone = appTimeZone()) {
  return new Date(endOfDayInTZ(date, timeZone).getTime() - 24 * 60 * 60 * 1000 + 1);
}

export { appTimeZone, endOfDayInTZ, startOfDayInTZ };
