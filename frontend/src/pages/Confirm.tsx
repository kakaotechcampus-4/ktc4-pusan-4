import { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { PlayIcon } from 'lucide-react';
import { AppShell } from '../components/AppShell';
import { StepEyebrow } from '../components/StepEyebrow';
import { InfoPanel, InfoRows, PANEL_LINK, PanelFailed, PanelNote } from '../components/InfoPanel';
import { useSession } from '../contexts/SessionContext';
import { api, ApiRequestError, useApi } from '../api';
import { Button } from '../components/ui';
import { uploadName } from '../copy';
import { formatNumber, formatPeriod } from '../utils/format';
import { contextRows, isJudgedIndustry } from '../utils/context';

/** 문진을 여기서 열면 저장하거나 돌아갈 때 이 화면으로 온다 (C3) */
const FROM_HERE = { from: '/confirm' };

export function Confirm() {
  const navigate = useNavigate();
  const { batchId, batchStatus, reloadBatch, context, contextRef, contextStatus, reloadContext } = useSession();
  /**
   * 업로드 이력에서 고르고 들어올 수도 있으므로 세션의 파싱 결과가 아니라 서버에서 읽는다.
   * 판정은 판정 대상이면서 분류를 마친 거래만 한다(실행의 totalCount). 분류하지 않은 거래는 빠진다 (C36)
   */
  const batchQ = useApi(async () => {
    if (!batchId) return null;
    const [batch, classified, unclassified] = await Promise.all([
    api.uploads.get(batchId),
    api.transactions.list({ batchId, status: 'JUDGEABLE', classificationStatus: 'CLASSIFIED', size: 1 }),
    api.transactions.list({ batchId, status: 'JUDGEABLE', classificationStatus: 'NEEDS_REVIEW', size: 1 })]
    );
    return { batch, judgeable: classified.page.totalElements, unclassified: unclassified.page.totalElements };
  }, [batchId]);
  // 다른 업로드로 바꾼 직후에는 앞 업로드의 응답이 남아 있다
  const loaded = batchQ.data && batchQ.data.batch.id === batchId ? batchQ.data : null;
  const [agreed, setAgreed] = useState(false);
  const [starting, setStarting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  /** 올린 카드내역을 아직 모르는 것과 정말 없는 것을 가른다 (C56) */
  const batchState =
  batchStatus === 'loading' ? 'loading' :
  batchStatus === 'error' ? 'error' :
  !batchId ? 'none' :
  batchQ.error ? 'error' :
  loaded ? 'ready' :
  'loading';

  /** 판정 시작을 막는 까닭. 읽는 중이거나 못 읽은 것은 위 칸이 알린다 */
  const blocked =
  batchState === 'none' ?
  '카드내역을 올리면 판정할 수 있습니다.' :
  contextStatus === 'none' ?
  '사업자 문진을 마치면 판정할 수 있습니다.' :
  contextStatus === 'ready' && context && !isJudgedIndustry(context.industryCode) ?
  '저장된 문진의 업종은 지금 판정하지 않습니다. 문진을 다시 저장해 주세요.' :
  loaded && loaded.judgeable === 0 ?
  loaded.unclassified > 0 ?
  '분류를 마친 거래가 없어 판정할 것이 없습니다.' :
  '이 카드내역에는 판정할 거래가 없습니다.' :
  null;
  const ready = batchState === 'ready' && contextStatus === 'ready' && contextRef !== null && blocked === null;

  const start = async () => {
    if (!batchId || !contextRef) return;
    setStarting(true);
    setError(null);
    try {
      const created = await api.runs.create({ batchId, contextId: contextRef.id });
      navigate(`/run/${created.id}`);
    } catch (caught) {
      // 탭 두 개에서 동시에 누르면 이미 돌고 있는 판정이 있다 (#228). 새로 시작하는 대신 그것을 보여준다
      if (
      caught instanceof ApiRequestError &&
      caught.code === 'RUN_ALREADY_ACTIVE' &&
      caught.runId)
      {
        navigate(`/run/${caught.runId}`);
        return;
      }
      setError(
        caught instanceof ApiRequestError ?
        caught.message :
        '판정을 시작하지 못했습니다. 잠시 후 다시 시도해 주세요.'
      );
    } finally {
      setStarting(false);
    }
  };

  return (
    <AppShell narrow>
      <div className="max-w-3xl">
        <header>
          <StepEyebrow />
          <h1 className="mt-1.5 text-h2 font-bold tracking-tight text-ink">판정 전 확인</h1>
        </header>

        <InfoPanel
          title="카드내역"
          action={
          batchState === 'ready' ?
          <Link to="/upload" className={PANEL_LINK}>다시 올리기</Link> :
          batchState === 'none' ?
          <Link to="/upload" className={PANEL_LINK}>카드내역 올리기</Link> :
          null
          }>

          {batchState === 'loading' && <PanelNote>불러오는 중…</PanelNote>}
          {batchState === 'error' &&
          <PanelFailed onRetry={batchStatus === 'error' ? reloadBatch : batchQ.reload}>
              카드내역을 불러오지 못했습니다.
            </PanelFailed>
          }
          {batchState === 'none' && <PanelNote>아직 올린 카드내역이 없습니다.</PanelNote>}
          {loaded &&
          <>
              <InfoRows
              rows={[
              { term: '파일', value: uploadName(loaded.batch) },
              { term: '기간', value: formatPeriod(loaded.batch.periodStart, loaded.batch.periodEnd) },
              { term: '판정할 거래', value: `${formatNumber(loaded.judgeable)}건` }]
              } />

              {loaded.unclassified > 0 &&
            <p className="flex flex-wrap items-center gap-x-3 gap-y-1 border-t border-line px-5 py-3 text-small text-ink">
                  분류하지 않은 거래 {formatNumber(loaded.unclassified)}건은 판정하지 않습니다.
                  <Link to="/preview" className={PANEL_LINK}>분류 확인</Link>
                </p>
            }
            </>
          }
        </InfoPanel>

        <InfoPanel
          title="사업자 문진"
          action={
          contextStatus === 'ready' ?
          <Link to="/interview" state={FROM_HERE} className={PANEL_LINK}>문진 고치기</Link> :
          contextStatus === 'none' ?
          <Link to="/interview" state={FROM_HERE} className={PANEL_LINK}>문진 하기</Link> :
          null
          }>

          {contextStatus === 'loading' && <PanelNote>불러오는 중…</PanelNote>}
          {contextStatus === 'error' && <PanelFailed onRetry={reloadContext}>문진을 불러오지 못했습니다.</PanelFailed>}
          {contextStatus === 'none' && <PanelNote>아직 문진을 하지 않았습니다.</PanelNote>}
          {contextStatus === 'ready' && context && <InfoRows rows={contextRows(context)} />}
        </InfoPanel>

        <div className="mt-8">
          {/*
            네모를 직접 그리지 않고 브라우저 것을 쓴다. 접근성 보고서(2026-10-22)가 이 자리에서
            세 가지를 지적했다 — 키보드 초점이 안 보이고, 레이블이 안 잡히고, 선택 전 테두리가
            흰 바탕 대비 1.19 다. 셋 다 `sr-only` 로 진짜 입력을 숨기고 span 으로 흉내 낸 탓이다.
            Signup.tsx·Questions.tsx 가 이미 브라우저 네모를 쓰고 있어 관례도 이쪽이다
          */}
          <label htmlFor="confirm-agree" className="flex cursor-pointer items-start gap-2.5">
            <input
              id="confirm-agree"
              type="checkbox"
              checked={agreed}
              onChange={(event) => setAgreed(event.target.checked)}
              className="mt-1 h-4 w-4 shrink-0 accent-accent" />

            <span className="text-body leading-6 text-ink">
              이 결과가 세무 신고를 확정하는 것이 아니며, 최종 판단에는 세무사의 확인이 필요하다는
              점을 이해했습니다.
            </span>
          </label>

          {blocked && <p className="mt-4 text-small text-ink2">{blocked}</p>}

          {error &&
          <p role="alert" className="mt-4 text-small text-deny">
              {error}
            </p>
          }

          <Button
            size="md"
            className="mt-4"
            disabled={!agreed || starting || !ready}
            onClick={() => void start()}>

            <PlayIcon className="h-4 w-4" aria-hidden="true" />
            {starting ? '판정을 시작하는 중…' : '판정 시작'}
          </Button>
        </div>
      </div>
    </AppShell>);

}
