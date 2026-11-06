import { DISCLAIMER } from '../copy';

/**
 * 전 화면 상시 노출. 세무대리로 오인될 소지를 화면에서 차단한다.
 * 문장은 copy.ts 한 곳에 둔다. 띠를 칠하지 않고 괘선으로만 가른다 (11/5 치오 방향)
 */
export function DisclaimerBar() {
  return (
    <div className="border-b border-line">
      <p className="mx-auto max-w-page px-6 py-2 text-caption text-ink2 [word-break:keep-all]">
        {DISCLAIMER}
      </p>
    </div>);

}
