import React from 'react';
import { useLocation } from 'react-router-dom';
import { AlertTriangleIcon } from 'lucide-react';
import { isMock } from '../api';
import { Button } from './ui';
import { BugReportButton } from './BugReport';

interface State {
  failed: boolean;
}

/** 화면을 그리다 예외가 나면 흰 화면 대신 안내를 띄운다. 다른 주소로 가면 다시 그려 본다 */
class Boundary extends React.Component<{children: React.ReactNode;resetKey: string;}, State> {
  state: State = { failed: false };

  static getDerivedStateFromError(): State {
    return { failed: true };
  }

  componentDidUpdate(previous: {resetKey: string;}) {
    if (this.state.failed && previous.resetKey !== this.props.resetKey) this.setState({ failed: false });
  }

  componentDidCatch(error: unknown) {
    console.error('[PreeT] 화면 오류', error);
  }

  render() {
    return this.state.failed ? <ErrorScreen /> : this.props.children;
  }
}

function ErrorScreen() {
  return (
    <div className="flex min-h-full items-center justify-center bg-canvas px-6 py-20">
      <div className="w-full max-w-md text-center">
        <span
          aria-hidden="true"
          className="mx-auto flex h-12 w-12 items-center justify-center rounded-full bg-deny-bg text-deny">
          
          <AlertTriangleIcon className="h-5 w-5" />
        </span>
        <h1 className="mt-5 text-h3 font-bold text-ink">화면을 그리지 못했습니다</h1>
        <p className="mt-2 text-body leading-7 text-ink2">
          {isMock ?
          '잠시 뒤 다시 시도해 주세요. 체험 화면은 새로고침하면 처음 상태로 돌아갑니다.' :
          '잠시 뒤 다시 시도해 주세요. 올린 카드내역과 판정은 서버에 그대로 있습니다.'}
        </p>
        <div className="mt-6 flex justify-center gap-2">
          <Button size="md" onClick={() => window.location.reload()}>
            새로고침
          </Button>
          <Button href="/" variant="secondary" size="md">
            홈으로
          </Button>
        </div>
        <p className="mt-6 text-small text-muted">
          계속 같은 화면에서 멈추면 <BugReportButton icon={false} className="inline align-baseline underline underline-offset-4 hover:text-ink" />로
          알려 주세요.
        </p>
      </div>
    </div>);

}

export function ErrorBoundary({ children }: {children: React.ReactNode;}) {
  const { pathname } = useLocation();
  return <Boundary resetKey={pathname}>{children}</Boundary>;
}
