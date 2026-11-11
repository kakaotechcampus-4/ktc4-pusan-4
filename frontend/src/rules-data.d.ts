/** 빌드 때 YAML 에서 만드는 모듈(scripts/rules-data.mjs) */
declare module 'virtual:rule-cards' {
  const cards: import('./types/rules').RuleCardInfo[];
  export default cards;
}

declare module 'virtual:glossary' {
  const glossary: import('./types/rules').GlossaryTerm[];
  export default glossary;
}

declare module 'virtual:eval-cases' {
  const evalCases: import('./types/rules').EvalCaseInfo[];
  export default evalCases;
}
