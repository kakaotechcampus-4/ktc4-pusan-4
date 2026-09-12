import type { SampleFile } from '../types/domain';

export const SAMPLE_FILES: SampleFile[] = [
{
  id: 'hometax-approval',
  fileName: '사업용신용카드_승인내역_202601.xlsx',
  issuer: '홈택스 사업용카드',
  format: 'XLSX',
  sourceType: 'APPROVAL',
  rowCount: 292,
  periodStart: '2026-01-01',
  periodEnd: '2026-01-31',
  encoding: 'UTF-8',
  headerRow: 4
},
{
  id: 'card-csv-approval',
  fileName: 'shinhan_approval_2601.csv',
  issuer: '신한카드',
  format: 'CSV',
  sourceType: 'APPROVAL',
  rowCount: 187,
  periodStart: '2026-01-01',
  periodEnd: '2026-01-31',
  encoding: 'EUC-KR',
  headerRow: 2
},
{
  id: 'card-csv-billing',
  fileName: 'kb_청구내역_2601.xlsx',
  issuer: 'KB국민카드',
  format: 'XLSX',
  sourceType: 'BILLING',
  rowCount: 204,
  periodStart: '2026-01-01',
  periodEnd: '2026-01-31',
  encoding: 'EUC-KR',
  headerRow: 3
}];


/** 브라우저 파싱이 읽어낸 원본 컬럼 → 표준 필드 매핑 */
export const COLUMN_MAPPING = [
{ source: '승인일자', target: 'transactedAt', label: '승인일', required: true },
{ source: '가맹점명', target: 'merchantRaw', label: '가맹점명', required: true },
{ source: '승인금액', target: 'amount', label: '승인금액', required: true },
{ source: '공급가액', target: 'supplyAmount', label: '공급가액', required: false },
{ source: '부가세', target: 'vatAmount', label: '부가세', required: false },
{ source: '할부개월', target: 'installmentMonths', label: '할부 개월', required: false }];


/** 파싱 단계에서 즉시 폐기하는 컬럼 (서버로 전송하지 않음) */
export const DISCARDED_COLUMNS = ['카드번호', '승인번호', '결제계좌번호'];

export const TARGET_FIELDS = [
{ value: 'transactedAt', label: '승인일' },
{ value: 'merchantRaw', label: '가맹점명' },
{ value: 'amount', label: '승인금액' },
{ value: 'supplyAmount', label: '공급가액' },
{ value: 'vatAmount', label: '부가세' },
{ value: 'installmentMonths', label: '할부 개월' },
{ value: 'IGNORE', label: '사용하지 않음' }];