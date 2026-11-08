// @vitest-environment jsdom
import { act, useState } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { ChoiceGroup, type ChoiceOption } from './ChoiceGroup';

const OPTIONS: ChoiceOption<string>[] = [
{ value: 'a', label: '가' },
{ value: 'b', label: '나', disabled: true },
{ value: 'c', label: '다' },
{ value: 'd', label: '라' }];


let root: Root;
let container: HTMLDivElement;

function Harness({ initial, selectOnFocus, spy }: {initial: string;selectOnFocus?: boolean;spy: (value: string) => void;}) {
  const [value, setValue] = useState(initial);
  return (
    <ChoiceGroup
      name="묶음"
      options={OPTIONS}
      value={value}
      selectOnFocus={selectOnFocus}
      onChange={(next) => {
        spy(next);
        setValue(next);
      }} />);


}

const render = (initial: string, selectOnFocus?: boolean) => {
  const spy = vi.fn();
  container = document.createElement('div');
  document.body.appendChild(container);
  root = createRoot(container);
  act(() => root.render(<Harness initial={initial} selectOnFocus={selectOnFocus} spy={spy} />));
  return spy;
};

const radios = () => [...container.querySelectorAll<HTMLButtonElement>('[role=radio]')];
const press = (key: string, init: KeyboardEventInit = {}) =>
act(() => {
  document.activeElement?.dispatchEvent(new KeyboardEvent('keydown', { key, bubbles: true, ...init }));
});

afterEach(() => {
  act(() => root.unmount());
  container.remove();
});

describe('ChoiceGroup 키보드', () => {
  it('Tab 은 고른 칸 하나에만 선다. 안 골랐으면 첫 칸이다', () => {
    render('c');
    expect(radios().map((r) => r.tabIndex)).toEqual([-1, -1, 0, -1]);
    act(() => root.unmount());
    container.remove();
    render('');
    expect(radios().map((r) => r.tabIndex)).toEqual([0, -1, -1, -1]);
  });

  it('화살표는 준비 중 칸을 건너뛰고 끝에서 돌며 바로 고른다', () => {
    const spy = render('a');
    radios()[0].focus();
    press('ArrowRight');
    expect(document.activeElement).toBe(radios()[2]);
    expect(spy).toHaveBeenLastCalledWith('c');
    press('ArrowLeft');
    press('ArrowLeft');
    expect(document.activeElement).toBe(radios()[3]);
    press('Home');
    expect(spy).toHaveBeenLastCalledWith('a');
  });

  it('selectOnFocus 를 끄면 화살표는 초점만 옮기고 고르지 않는다', () => {
    const spy = render('a', false);
    radios()[0].focus();
    press('ArrowRight');
    expect(document.activeElement).toBe(radios()[2]);
    expect(spy).not.toHaveBeenCalled();
    // Tab 은 초점이 있는 칸 하나에만 선다. Shift+Tab 한 번에 묶음을 벗어난다
    expect(radios().map((r) => r.tabIndex)).toEqual([-1, -1, 0, -1]);
  });

  it('Alt 같은 보조 키와 함께 누르면 건드리지 않는다', () => {
    const spy = render('a');
    radios()[0].focus();
    press('ArrowLeft', { altKey: true });
    expect(document.activeElement).toBe(radios()[0]);
    expect(spy).not.toHaveBeenCalled();
  });
});
