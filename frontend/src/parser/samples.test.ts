import { describe, expect, it } from 'vitest';
import { detectFormat } from './detect';
import { buildIbkHtml, sampleFiles } from './samples';

describe('sampleFiles', () => {
  it('KB 승인내역 · IBK 승인내역 · KB 청구내역 파일을 만든다', async () => {
    const files = await sampleFiles();
    expect(files.map((f) => [f.id, f.file.name])).toEqual([
      ['kb', 'kb_sample.xls'],
      ['ibk', 'ibk_sample.xls'],
      ['billing', 'kb_billing_sample.xls']]);
    const formats = await Promise.all(files.map(async (f) => detectFormat(new Uint8Array(await f.file.arrayBuffer()))));
    expect(formats).toEqual(['kb', 'ibk', 'kb']);
  });
});

describe('buildIbkHtml', () => {
  it('실제 파일처럼 <html 로 시작하고 표는 그 뒤에 온다', () => {
    const html = buildIbkHtml('full');
    expect(html.startsWith('<html>')).toBe(true);
    expect(html.indexOf('<table')).toBeGreaterThan(200);
  });
});
