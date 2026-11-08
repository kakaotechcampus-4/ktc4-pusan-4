import { CheckIcon } from 'lucide-react';
import { passwordProblem } from '../utils/password';

/**
 * 적는 동안 규칙에 맞는지 칸 아래에 알린다. 빨갛게 칠하지 않는다. 아직 다 적지 않았을 수 있다.
 * 같은 칸에 오류가 떠 있으면 숨긴다. 같은 말을 두 번 하지 않는다
 */
export function PasswordCheck({ id, password, hidden }: {id: string;password: string;hidden?: boolean;}) {
  if (password === '' || hidden) return null;
  const problem = passwordProblem(password);
  return (
    <p id={id} aria-live="polite" className={`mt-1.5 flex items-center gap-1 text-[12px] ${problem ? 'text-ink2' : 'text-ink'}`}>
      {!problem && <CheckIcon className="h-3.5 w-3.5" aria-hidden="true" />}
      {problem ?? '쓸 수 있는 비밀번호입니다.'}
    </p>);

}
