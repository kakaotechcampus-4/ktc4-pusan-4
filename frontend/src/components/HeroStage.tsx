import { AgentPreview } from './AgentPreview';
import { HERO_SUMMARY } from '../mock/marketing';
import { formatWon } from '../utils/format';

/**
 * 랜딩 히어로의 입체 무대.
 * 뒤에 결과 요약, 앞에 판정이 도는 패널을 겹쳐 「판정 → 결과」를 한 화면에 보여준다.
 * 기울임(rotate)과 등장(translate)은 서로 다른 요소에 건다 — 한 요소에 걸면 transform 이 덮어쓴다.
 * 앱 화면에는 쓰지 않는다. 판정 화면은 차분해야 한다 (DESIGN.md).
 */
export function HeroStage() {
  return (
    <div className="relative h-[440px] w-[340px] [perspective:1400px] sm:h-[540px] sm:w-[400px]">
      {/* 액센트 광원. 장식이라 읽기에 영향을 주지 않는다 */}
      <div
        aria-hidden="true"
        className="pointer-events-none absolute -right-16 -top-20 h-64 w-64 rounded-full bg-accent/25 blur-[80px]" />
      
      <div
        aria-hidden="true"
        className="pointer-events-none absolute -bottom-10 -left-14 h-52 w-52 rounded-full bg-ok/15 blur-[70px]" />
      

      {/* 뒤 카드 — 결과 요약. 앞 카드 위로 머리만 내민다 */}
      <div
        aria-hidden="true"
        className="absolute -right-6 top-0 hidden w-[268px] motion-safe:animate-rise sm:block">
        
        <div className="rounded-2xl border border-line bg-surface/95 p-5 shadow-panel [transform:rotateX(16deg)_rotateY(-22deg)_rotateZ(2deg)]">
          <p className="text-caption text-muted">인정 가능 경비</p>
          <p className="mt-1 text-h3 font-bold tabular-nums text-ink">
            {formatWon(HERO_SUMMARY.availableAmount)}
          </p>
          <div className="mt-4 flex h-2 overflow-hidden rounded-full bg-line2">
            {HERO_SUMMARY.distribution.map((item) =>
            <div
              key={item.label}
              className={item.bar}
              style={{ width: `${item.count / HERO_SUMMARY.total * 100}%` }} />

            )}
          </div>
        </div>
      </div>

      {/* 앞 카드 — 실제 판정 트레이스 */}
      <div className="absolute bottom-0 left-0 motion-safe:animate-rise">
        <div className="transition-transform duration-500 ease-snap sm:[transform:rotateX(7deg)_rotateY(-13deg)] sm:hover:[transform:rotateX(2deg)_rotateY(-4deg)]">
          <AgentPreview />
        </div>
      </div>
    </div>);

}
