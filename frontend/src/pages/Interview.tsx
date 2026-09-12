import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { ArrowRightIcon, InfoIcon } from 'lucide-react';
import { AppShell } from '../components/AppShell';
import { DEFAULT_CONTEXT, useSession } from '../contexts/SessionContext';
import type { BusinessContext, WorkplaceType } from '../types/domain';
import { formatNumber } from '../utils/format';

const INDUSTRIES = [
{ code: '62010', label: '62010 · 컴퓨터 프로그래밍 서비스업' },
{ code: '62021', label: '62021 · 시스템 통합 자문·구축 서비스업' },
{ code: '73909', label: '73909 · 그 외 기타 전문·과학·기술 서비스업' },
{ code: '85699', label: '85699 · 그 외 기타 교육 지원 서비스업' }];


const WORKPLACES: {value: WorkplaceType;label: string;hint: string;}[] = [
{ value: 'HOME', label: '자택 겸용', hint: '가사 관련 경비 안분이 필요합니다' },
{ value: 'OFFICE', label: '별도 사무실', hint: '임차료 전액 검토 대상' },
{ value: 'NONE', label: '고정 작업장 없음', hint: '공간 관련 경비 판정 제외' }];


const cardClass = 'rounded-2xl border border-line bg-surface p-5';
const labelClass = 'text-[14px] font-semibold text-ink';
const hintClass = 'mt-1 text-[13px] leading-6 text-muted';

function ChoiceRow<T extends string | boolean>({
  options,
  value,
  onChange,
  name





}: {options: {value: T;label: string;hint?: string;}[];value: T;onChange: (value: T) => void;name: string;}) {
  return (
    <div role="radiogroup" aria-label={name} className="mt-3 grid gap-2 sm:grid-cols-3">
      {options.map((option) => {
        const selected = option.value === value;
        return (
          <button
            key={String(option.value)}
            type="button"
            role="radio"
            aria-checked={selected}
            onClick={() => onChange(option.value)}
            className={`rounded-xl border px-3.5 py-3 text-left transition-colors duration-150 ease-snap ${
            selected ?
            'border-accent bg-accent-soft' :
            'border-line bg-surface hover:bg-canvas'}`
            }>
            
            <span
              className={`block text-[13px] font-semibold ${
              selected ? 'text-accent' : 'text-ink'}`
              }>
              
              {option.label}
            </span>
            {option.hint &&
            <span className="mt-0.5 block text-[12px] leading-5 text-muted">
                {option.hint}
              </span>
            }
          </button>);

      })}
    </div>);

}

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

  const impacts = [
  form.hasEmployees ?
  '직원이 있어 복리후생비·급여 관련 판정 분기가 켜집니다.' :
  '직원이 없어 회식·복리후생 성격의 지출은 가사 관련 경비로 봅니다.',
  form.workplaceType === 'HOME' ?
  `자택 겸용이라 공간 관련 경비를 ${form.homeOfficeRatio}% 기준으로 안분합니다.` :
  form.workplaceType === 'OFFICE' ?
  '별도 사무실 임차료는 전액 검토 대상입니다.' :
  '고정 작업장이 없어 공간 관련 경비는 판정 대상에서 제외합니다.',
  form.hasVehicle ?
  '사업용 차량이 있어 유류비·수리비를 업무용승용차 규정으로 검토합니다.' :
  '사업용 차량이 없어 유류비는 근거 조문에 따라 불가로 판정합니다.'];


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
              사업자 문진 7문항
            </h1>
            <p className="mt-2 max-w-2xl text-[14px] leading-6 text-ink2">
              같은 지출도 사업자 상황에 따라 결과가 달라집니다. 답변은 버전으로
              저장되고, 판정 결과에는 어떤 버전으로 판단했는지 기록됩니다.
            </p>
          </header>

          <div className="mt-6 space-y-4">
            <section className={cardClass}>
              <label htmlFor="industry" className={labelClass}>
                1. 업종
              </label>
              <p className={hintClass}>
                업종 프로파일과 경비율 조회의 기준이 됩니다.
              </p>
              <select
                id="industry"
                value={form.industryCode}
                onChange={(event) => update('industryCode', event.target.value)}
                className="mt-3 w-full rounded-xl border border-line bg-surface px-3.5 py-2.5 text-[14px] text-ink">
                
                {INDUSTRIES.map((industry) =>
                <option key={industry.code} value={industry.code}>
                    {industry.label}
                  </option>
                )}
              </select>
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
              <span className={labelClass}>4. 직원이 있나요?</span>
              <p className={hintClass}>
                급여·원천세는 이 서비스의 범위 밖입니다. 복리후생비 판정에만
                사용합니다.
              </p>
              <ChoiceRow
                name="직원 유무"
                value={form.hasEmployees}
                onChange={(value) => update('hasEmployees', value)}
                options={[
                { value: false, label: '없음 (1인)' },
                { value: true, label: '있음' }]
                } />
              
            </section>

            <section className={cardClass}>
              <span className={labelClass}>5. 작업 공간은 어떤 형태인가요?</span>
              <ChoiceRow
                name="작업장 형태"
                value={form.workplaceType}
                onChange={(value) => update('workplaceType', value)}
                options={WORKPLACES} />
              
              {form.workplaceType === 'HOME' &&
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
                    value={form.homeOfficeRatio}
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

            <section className={cardClass}>
              <span className={labelClass}>6. 사업용 차량이 있나요?</span>
              <ChoiceRow
                name="차량 보유"
                value={form.hasVehicle}
                onChange={(value) => update('hasVehicle', value)}
                options={[
                { value: false, label: '없음' },
                { value: true, label: '있음' }]
                } />
              
            </section>

            <section className={cardClass}>
              <span className={labelClass}>
                7. 별도의 사업장 시설(창고·스튜디오 등)이 있나요?
              </span>
              <ChoiceRow
                name="시설 보유"
                value={form.hasPhysicalFacility}
                onChange={(value) => update('hasPhysicalFacility', value)}
                options={[
                { value: false, label: '없음' },
                { value: true, label: '있음' }]
                } />
              
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