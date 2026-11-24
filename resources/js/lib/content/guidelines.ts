

type GuidelineSection = { id: string; title: string; paragraphs: string[] };

export function parseGuidelineSections(body: string): GuidelineSection[] {
  const sections: GuidelineSection[] = [];
  for (const line of body.split(/\r?\n/)) {
    const text = line.trim();
    if (!text) continue;
    if (text.startsWith('# ')) {
      sections.push({ id: `guideline-${sections.length + 1}`, title: text.slice(2).trim(), paragraphs: [] });
    } else {
      if (sections.length === 0) sections.push({ id: 'guideline-1', title: 'Overview', paragraphs: [] });
      sections[sections.length - 1].paragraphs.push(text);
    }
  }
  return sections;
}
