import React, { useEffect, useId, useRef, useState } from 'react';
import { Link, useLocation, useNavigate } from 'react-router-dom';
import { ChevronDownIcon, UserRoundIcon } from 'lucide-react';
import { useSession } from '../contexts/SessionContext';
import { displayName } from '../utils/account';
import { cn } from './ui';
import { under } from './steps';

interface MenuLink {path: string;label: string;}

const LINKS: MenuLink[] = [
{ path: '/account', label: '내 정보' },
{ path: '/transactions', label: '거래' },
{ path: '/uploads', label: '업로드 이력' }];

/** 관리자에게만 보인다 (M1) */
const ADMIN_LINK: MenuLink = { path: '/admin', label: '관리자' };

/* 초점 테는 전역 테(2px ink)를 안쪽으로 그린다. 옅은 바탕만 바꾸면 흰 메뉴 위에서 보이지 않는다 */
const ITEM =
'block w-full whitespace-nowrap px-4 py-2.5 text-left text-body text-ink transition-colors duration-150 ease-snap hover:bg-surface focus-visible:bg-surface focus-visible:outline-offset-[-2px]';

/**
 * 사용자 이름을 누르면 여는 메뉴. 내 정보, 자료 화면, 로그아웃을 모았다.
 * 앱 머리띠(AppShell)와 로그인한 공개 화면 머리(MarketingHeader)가 같이 쓴다.
 * home: 로그아웃하면 랜딩으로 간다. 공개 화면(FAQ, 약관)은 로그아웃해도 그 화면을 그대로 둔다
 */
export function AccountMenu({ home = true }: {home?: boolean;}) {
  const { email, isAdmin, signOut } = useSession();
  const { pathname } = useLocation();
  const navigate = useNavigate();
  const [open, setOpen] = useState(false);
  const root = useRef<HTMLDivElement>(null);
  const trigger = useRef<HTMLButtonElement>(null);
  const menu = useRef<HTMLUListElement>(null);
  const menuId = useId();
  const links = isAdmin ? [...LINKS, ADMIN_LINK] : LINKS;
  const name = displayName(email);

  const items = () => Array.from(menu.current?.querySelectorAll<HTMLElement>('[role="menuitem"]') ?? []);

  /** 열면서 초점을 둘 항목. -1 은 마지막 */
  const show = (at: 0 | -1) => {
    setOpen(true);
    window.setTimeout(() => items().at(at)?.focus(), 0);
  };

  const close = (refocus: boolean) => {
    setOpen(false);
    if (refocus) trigger.current?.focus();
  };

  // 메뉴 밖을 누르면 닫는다. 누른 곳으로 초점이 가야 하니 버튼으로 되돌리지 않는다
  useEffect(() => {
    if (!open) return;
    const onPointerDown = (event: PointerEvent) => {
      if (!root.current?.contains(event.target as Node)) setOpen(false);
    };
    document.addEventListener('pointerdown', onPointerDown);
    return () => document.removeEventListener('pointerdown', onPointerDown);
  }, [open]);

  // 다른 화면으로 옮기면 닫는다
  useEffect(() => {
    setOpen(false);
  }, [pathname]);

  const onTriggerKey = (event: React.KeyboardEvent) => {
    if (event.key === 'ArrowDown') {
      event.preventDefault();
      show(0);
    } else if (event.key === 'ArrowUp') {
      event.preventDefault();
      show(-1);
    }
  };

  const onMenuKey = (event: React.KeyboardEvent) => {
    const list = items();
    const at = list.indexOf(document.activeElement as HTMLElement);
    const move = (to: number) => {
      event.preventDefault();
      list[(to + list.length) % list.length]?.focus();
    };
    if (event.key === 'ArrowDown') move(at + 1);
    else if (event.key === 'ArrowUp') move(at - 1);
    else if (event.key === 'Home') move(0);
    else if (event.key === 'End') move(list.length - 1);
    else if (event.key === 'Escape') {
      event.preventDefault();
      close(true);
    } else if (event.key === 'Tab') close(false);
  };

  return (
    <div ref={root} className="relative shrink-0">
      <button
        ref={trigger}
        type="button"
        aria-haspopup="menu"
        aria-expanded={open}
        aria-controls={open ? menuId : undefined}
        onClick={() => open ? close(false) : show(0)}
        onKeyDown={onTriggerKey}
        title={name}
        className={cn(
          'flex h-9 max-w-[200px] items-center gap-1.5 rounded-full px-3 text-small font-bold text-ink transition-colors duration-150 ease-snap hover:bg-surface',
          open && 'bg-surface'
        )}>

        <UserRoundIcon className="h-4 w-4 shrink-0 text-ink2" aria-hidden="true" />
        <span className="min-w-0 truncate">{name}</span>
        <ChevronDownIcon
          className={cn('h-4 w-4 shrink-0 text-ink2 transition-transform duration-150', open && 'rotate-180')}
          aria-hidden="true" />
      </button>

      {open &&
      <ul
        ref={menu}
        id={menuId}
        role="menu"
        aria-label={name}
        onKeyDown={onMenuKey}
        className="absolute right-0 top-full z-40 mt-2 min-w-[180px] overflow-hidden rounded-xl border border-line bg-canvas py-1.5 shadow-header">

          {links.map((link) => {
          const here = under(pathname, link.path);
          return (
            <li key={link.path} role="none">
              <Link
                to={link.path}
                role="menuitem"
                tabIndex={-1}
                aria-current={here ? 'page' : undefined}
                // 지금 화면을 고르면 화면이 바뀌지 않아 초점이 갈 곳이 없다. 이름 버튼으로 돌려놓는다
                onClick={() => close(here)}
                className={cn(ITEM, here && 'font-bold')}>

                {link.label}
              </Link>
            </li>);

        })}
          <li role="separator" className="my-1.5 border-t border-line" />
          <li role="none">
            <button
            type="button"
            role="menuitem"
            tabIndex={-1}
            onClick={() => {
              setOpen(false);
              signOut();
              if (home) navigate('/');
            }}
            className={ITEM}>

              로그아웃
            </button>
          </li>
        </ul>
      }
    </div>);

}
