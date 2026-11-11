// @vitest-environment jsdom
import { act, useState } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { ChoiceGroup, type ChoiceOption } from './ChoiceGroup';

(globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;

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

describe('ChoiceGroup 다시 눌러 거두기', () => {
  const renderClearable = (onClear?: () => void) => {
    const spy = vi.fn();
    container = document.createElement('div');
    document.body.appendChild(container);
    root = createRoot(container);
    act(() => root.render(<ChoiceGroup name="묶음" options={OPTIONS} value="a" onChange={spy} onClear={onClear} />));
    return spy;
  };

  it('onClear 가 있으면 고른 칸을 다시 누를 때 거둔다', () => {
    const clear = vi.fn();
    const spy = renderClearable(clear);
    act(() => radios()[0].click());
    expect(clear).toHaveBeenCalledTimes(1);
    expect(spy).not.toHaveBeenCalled();
    act(() => radios()[2].click());
    expect(spy).toHaveBeenLastCalledWith('c');
  });

  it('onClear 가 없으면 다시 눌러도 고른 값을 다시 알릴 뿐이다', () => {
    const spy = renderClearable();
    act(() => radios()[0].click());
    expect(spy).toHaveBeenLastCalledWith('a');
  });
});

describe('ChoiceGroup 화살표로 고른 뒤 Space', () => {
  it('화살표로 고른 칸에서 Space(click)를 눌러도 거두지 않는다', () => {
    const clear = vi.fn();
    const spy = vi.fn();
    container = document.createElement('div');
    document.body.appendChild(container);
    root = createRoot(container);
    function Clearable() {
      const [value, setValue] = useState('a');
      return <ChoiceGroup name="묶음" options={OPTIONS} value={value} onChange={(next) => {spy(next);setValue(next);}} onClear={clear} />;
    }
    act(() => root.render(<Clearable />));
    radios()[0].focus();
    press('ArrowRight');
    expect(spy).toHaveBeenLastCalledWith('c');
    // 버튼에서 Space 를 떼면 브라우저가 click 을 보낸다
    act(() => radios()[2].click());
    expect(clear).not.toHaveBeenCalled();
    // 그 뒤에 다시 누르면 거둔다
    act(() => radios()[2].click());
    expect(clear).toHaveBeenCalledTimes(1);
  });
});
