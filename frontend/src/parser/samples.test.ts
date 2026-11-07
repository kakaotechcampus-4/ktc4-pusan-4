import { describe, expect, it } from 'vitest';
import { detectFormat } from './detect';
import { buildIbkHtml, sampleFiles } from './samples';

describe('sampleFiles', () => {
  it('KB 승인내역과 IBK 승인내역만 내놓는다. 늘 막히는 청구내역은 넣지 않는다', async () => {
    const files = await sampleFiles();
    expect(files.map((f) => [f.id, f.label, f.file.name])).toEqual([
      ['kb', 'KB국민카드 승인내역', 'kb_sample.xls'],
      ['ibk', 'IBK기업은행 승인내역', 'ibk_sample.xls']]);
    const formats = await Promise.all(files.map(async (f) => detectFormat(new Uint8Array(await f.file.arrayBuffer()))));
    expect(formats).toEqual(['kb', 'ibk']);
  });
});

describe('buildIbkHtml', () => {
  it('실제 파일처럼 <html 로 시작하고 표는 그 뒤에 온다', () => {
    const html = buildIbkHtml('full');
    expect(html.startsWith('<html>')).toBe(true);
    expect(html.indexOf('<table')).toBeGreaterThan(200);
  });
});
