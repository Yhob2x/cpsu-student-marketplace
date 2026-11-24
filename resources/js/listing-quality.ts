/** Advisory editorial checks. Never publish, rewrite, hide, or reject a listing automatically. */
export function assessListingReadability(title: string, description: string): string[] {
  const result: string[] = [];
  const heading = title.trim().replace(/\s+/g, ' ');
  const body = description.trim().replace(/\s+/g, ' ');
  if (/^(?:(?:my|new|used|nice|good|best|sample|demo|placeholder)\s+)*(?:product|item|service|listing|stuff|things?|test|sample|demo)(?:\s+\d+)?[!.]*$/i.test(heading)) {
    result.push('Replace generic wording with the actual item or service name.');
  }
  if (heading.length < 12) result.push('Use a descriptive title of at least 12 characters.');
  if (/(.)\1{7,}/i.test(heading) || /^([a-z]{2,4})\1{3,}$/i.test(heading.replace(/\s/g, ''))) {
    result.push('Replace repeated letters or placeholder text with the actual item or service name.');
  }
  const letters = heading.replace(/[^A-Za-z]/g, '');
  if (letters.length >= 10 && letters === letters.toUpperCase()) {
    result.push('Avoid ALL CAPS so students can scan the title easily.');
  }
  if (body.length < 24 || /^(?:nice|good|best|great|new|used)\s+(?:product|item|service|listing)[.!]?$/i.test(body)) {
    result.push('Describe condition, scope, or included details in a complete sentence.');
  }
  return result;
}
