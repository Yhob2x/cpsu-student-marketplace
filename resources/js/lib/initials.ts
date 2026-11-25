/** One or two uppercase letters for an avatar: first and last word, or the first two letters of a single word. */
export function initialsOf(name: string): string {
  const words = name.trim().split(/\s+/).filter(Boolean);
  return (words.length > 1 ? words[0][0] + words[words.length - 1][0] : words[0]?.slice(0, 2) || 'U').toLocaleUpperCase();
}
