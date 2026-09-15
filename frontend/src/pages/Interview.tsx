import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { ArrowRightIcon, InfoIcon } from 'lucide-react';
import { AppShell } from '../components/AppShell';
import { DEFAULT_CONTEXT, useSession } from '../contexts/SessionContext';
import type { BookkeepingDuty, BusinessContext } from '../types/domain';
import { ChoiceGroup, type ChoiceOption } from '../components/ui';
import { formatNumber } from '../utils/format';

/**
 * 서비스는 IT 개발·프리랜서만 동작한다. 다른 직종은 보이되 선택되지 않는다 —
 * 있지만 안 되는 선택지는 '준비 중'으로 표기한다 (DESIGN.md).
 */
const INDUSTRIES: ChoiceOption<string>[] = [
{ value: '62010', label: 'IT 개발 · 프리랜서', hint: '62010 컴퓨터 프로그래밍' },
{ value: '73203', label: '디자이너', disabled: true },
{ value: '85699', label: '온라인 강사', disabled: true },
{ value: '59120', label: '영상 편집', disabled: true },
{ value: '47912', label: '온라인 판매', disabled: true },
{ value: 'ETC', label: '그 외', disabled: true }];


const BOOKKEEPING: ChoiceOption<BookkeepingDuty>[] = [
{ value: '복식부기', label: '복식부기', hint: '직전연도 수입 7,500만 원 이상' },
{ value: '간편장부', label: '간편장부', hint: '서비스 대상 밖 (참고용)' },
{ value: '추계', label: '추계', hint: '서비스 대상 밖 (참고용)' }];


const cardClass = 'rounded-2xl border border-line bg-surface p-5';
const labelClass = 'text-[14px] font-semibold text-ink';
const hintClass = 'mt-1 text-[13px] leading-6 text-muted';

export function Interview() {
  const navigate = useNavigate();
  const { setContext } = useSession();
  const [form, setForm] = useState<BusinessContext>(DEFAULT_CONTEXT);

  const update = <K extends keyof BusinessContext,>(
  key: K,
  value: BusinessContext[K]) =>
  setForm((prev) => ({ ...prev, [key]: value }));

  const bookkeeping =
  form.prevYearRevenue >= 75_000_000 ? '복식부기 의무자' : '간편장부 대상자';
  const homeOffice = form.homeOfficeRatio !== undefined;

  const impacts = [
  form.hasEmployee ?
  '직원이 있어 복리후생비·급여 관련 판정 분기가 켜집니다.' :
  '직원이 없어 회식·복리후생 성격의 지출은 가사 관련 경비로 봅니다.',
  homeOffice ?
  `자택 겸용이라 공간 관련 경비를 ${form.homeOfficeRatio}% 기준으로 안분합니다.` :
  '자택 작업 비율이 없어 통신비·관리비 안분 판정을 하지 않습니다.'];


  const submit = (event: React.FormEvent) => {
    event.preventDefault();
    setContext(form);
    navigate('/confirm');
  };

  return (
    <AppShell>
      <div className="grid gap-8 lg:grid-cols-[minmax(0,1fr)_320px]">
        <form onSubmit={submit}>
          <header>
            <p className="text-[13px] font-semibold text-accent">1단계 · 인식</p>
            <h1 className="mt-1.5 text-[28px] font-bold tracking-tight text-ink">
              사업자 문진
            </h1>
            <p className="mt-2 max-w-2xl text-[14px] leading-6 text-ink2">
              같은 지출도 사업자 상황에 따라 결과가 달라집니다. 답변은 버전으로
              저장되고, 판정 결과에는 어떤 버전으로 판단했는지 기록됩니다.
            </p>
          </header>

          <div className="mt-6 space-y-4">
            <section className={cardClass}>
              <span className={labelClass}>1. 업종</span>
              <p className={hintClass}>
                지금은 IT 개발·프리랜서만 판정합니다. 다른 직종은 규칙 카드가 준비되면
                열립니다.
              </p>
              <ChoiceGroup
                name="업종"
                className="mt-3"
                value={form.industryCode}
                onChange={(value) => update('industryCode', value)}
                options={INDUSTRIES} />
            </section>

            <section className={cardClass}>
              <label htmlFor="revenue" className={labelClass}>
                2. 직전연도 수입금액
              </label>
              <p className={hintClass}>
                기장 의무와 연중 한도 잠정 계산의 기준입니다.
              </p>
              <div className="mt-3 flex items-center gap-2">
                <input
                  id="revenue"
                  type="number"
                  min={0}
                  step={1_000_000}
                  value={form.prevYearRevenue}
                  onChange={(event) =>
                  update('prevYearRevenue', Number(event.target.value))
                  }
                  className="w-56 rounded-xl border border-line px-3.5 py-2.5 text-[14px] tabular-nums text-ink" />
                
                <span className="text-[13px] tabular-nums text-muted">
                  {formatNumber(form.prevYearRevenue)}원
                </span>
              </div>
            </section>

            <section className={cardClass}>
              <label htmlFor="openDate" className={labelClass}>
                3. 개업일
              </label>
              <p className={hintClass}>신규 사업자 여부에 따라 경비율 구간이 달라집니다.</p>
              <input
                id="openDate"
                type="date"
                value={form.businessOpenDate}
                onChange={(event) =>
                update('businessOpenDate', event.target.value)
                }
                className="mt-3 rounded-xl border border-line px-3.5 py-2.5 text-[14px] tabular-nums text-ink" />
              
            </section>

            <section className={cardClass}>
              <span className={labelClass}>4. 기장의무</span>
              <p className={hintClass}>
                직전연도 수입금액으로 자동 판정된 값이 기본 선택됩니다.
              </p>
              <ChoiceGroup
                className="mt-3"
                name="기장의무"
                value={form.bookkeepingDuty}
                onChange={(value) => update('bookkeepingDuty', value)}
                options={BOOKKEEPING} />
              
            </section>

            <section className={cardClass}>
              <span className={labelClass}>5. 직원이 있나요?</span>
              <p className={hintClass}>
                직원 보유 사업자는 서비스 대상 밖입니다. 복리후생비 판정에만
                사용합니다.
              </p>
              <ChoiceGroup
                className="mt-3"
                name="직원 유무"
                value={form.hasEmployee}
                onChange={(value) => update('hasEmployee', value)}
                options={[
                { value: false, label: '없음 (1인)' },
                { value: true, label: '있음' }]
                } />
              
            </section>

            <section className={cardClass}>
              <span className={labelClass}>6. 자택에서 작업하나요?</span>
              <p className={hintClass}>
                자택 겸용이면 통신비·관리비를 업무 사용 비율로 안분합니다.
              </p>
              <ChoiceGroup
                className="mt-3"
                name="자택 작업 여부"
                value={homeOffice}
                onChange={(value) =>
                update('homeOfficeRatio', value ? 20 : undefined)
                }
                options={[
                { value: false, label: '아니오', hint: '별도 사무실 · 고정 작업장 없음' },
                { value: true, label: '예', hint: '가사 관련 경비 안분이 필요합니다' }]
                } />
              
              {homeOffice &&
              <div className="mt-4 rounded-xl bg-canvas p-4">
                  <label
                  htmlFor="ratio"
                  className="text-[13px] font-semibold text-ink">
                  
                    자택에서 작업공간이 차지하는 면적 비율
                  </label>
                  <div className="mt-2.5 flex items-center gap-3">
                    <input
                    id="ratio"
                    type="range"
                    min={0}
                    max={100}
                    step={5}
                    value={form.homeOfficeRatio ?? 0}
                    onChange={(event) =>
                    update('homeOfficeRatio', Number(event.target.value))
                    }
                    className="h-1.5 flex-1 accent-accent" />
                  
                    <span className="w-12 text-right text-[14px] font-semibold tabular-nums text-ink">
                      {form.homeOfficeRatio}%
                    </span>
                  </div>
                </div>
              }
            </section>
          </div>

          <div className="mt-6 flex items-center gap-3">
            <button
              type="submit"
              className="inline-flex items-center gap-2 rounded-xl bg-accent px-4 py-2.5 text-sm font-semibold text-white transition-colors duration-150 ease-snap hover:bg-accent-hover">
              
              다음: 입력 확정
              <ArrowRightIcon className="h-4 w-4" aria-hidden="true" />
            </button>
            <button
              type="button"
              onClick={() => navigate('/upload')}
              className="text-[13px] font-medium text-muted transition-colors duration-150 hover:text-ink">
              
              이전 단계
            </button>
          </div>
        </form>

        <aside className="lg:sticky lg:top-32 lg:self-start">
          <div className="rounded-2xl border border-line bg-surface p-5">
            <p className="text-[12px] text-muted">자동 판정</p>
            <p className="mt-1 text-[18px] font-bold text-ink">{bookkeeping}</p>
            <p className="mt-2 text-[13px] leading-6 text-muted">
              직전연도 수입금액 {formatNumber(form.prevYearRevenue)}원 기준으로
              산정했습니다.
            </p>
          </div>

          <div className="mt-4 rounded-2xl border border-line bg-surface p-5">
            <div className="flex items-center gap-2">
              <InfoIcon className="h-4 w-4 text-accent" aria-hidden="true" />
              <h2 className="text-sm font-semibold text-ink">
                이 답변이 바꾸는 것
              </h2>
            </div>
            <ul className="mt-3 space-y-2.5">
              {impacts.map((impact) =>
              <li
                key={impact}
                className="text-[13px] leading-6 text-ink2 before:mr-1.5 before:text-muted before:content-['·']">
                
                  {impact}
                </li>
              )}
            </ul>
          </div>
        </aside>
      </div>
    </AppShell>);

}