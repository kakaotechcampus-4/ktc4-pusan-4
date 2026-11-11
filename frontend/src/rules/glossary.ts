import glossary from 'virtual:glossary';
import type { GlossaryTerm } from '../types/rules';

/** 빌드 때 rules/glossary.yaml 에서 옮긴 용어집 */
export const GLOSSARY: readonly GlossaryTerm[] = glossary;

const norm = (text: string) => text.replace(/\s+/g, '').replace(/[.,!?'"()「」]/g, '');

/** 고른 글이 낱말 하나와 같으면 그 항목. 문장 안에 낱말이 들어 있기만 하면 맞지 않는다 */
export function lookup(text: string, items: readonly GlossaryTerm[] = GLOSSARY): GlossaryTerm | null {
  const key = norm(text);
  if (!key || key.length > 12) return null;
  return items.find((item) => [item.term, ...item.aliases].some((name) => norm(name) === key)) ?? null;
}
