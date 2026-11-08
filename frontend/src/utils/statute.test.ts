import { describe, expect, it } from 'vitest';
import { statuteTitle } from './statute';

describe('statuteTitle', () => {
  it('법령 조문 id 로 조·항·호를 붙인다', () => {
    expect(statuteTitle('소득세법-27', '소득세법')).toBe('소득세법 제27조');
    expect(statuteTitle('소득세법-33-1-5', '소득세법')).toBe('소득세법 제33조 제1항 제5호');
    expect(statuteTitle('소득세법-81의6-1', '소득세법')).toBe('소득세법 제81조의6 제1항');
    expect(statuteTitle('소득세법시행령-208의2-1', '소득세법 시행령')).toBe('소득세법 시행령 제208조의2 제1항');
    expect(statuteTitle('소득세법시행령-190-1-1의2', '소득세법 시행령')).toBe('소득세법 시행령 제190조 제1항 제1호의2');
    expect(statuteTitle('조세특례제한법시행규칙-61-1-12', '조세특례제한법 시행규칙')).toBe(
      '조세특례제한법 시행규칙 제61조 제1항 제12호'
    );
  });

  it('행정규칙은 조를 붙이고, 전문은 그대로 둔다', () => {
    expect(statuteTitle('국세청사무분장규정#34999-13의8', '국세청 사무분장규정')).toBe('국세청 사무분장규정 제13조의8');
    expect(statuteTitle('일반주택에대한기준시가#34981-전문', '일반주택에 대한 기준시가')).toBe('일반주택에 대한 기준시가');
  });

  it('심판례·해석례는 사건 제목을 그대로 쓴다', () => {
    const decision = '종합소득세 결정시 누락된 필요경비에 산입할 금액이 있는지 여부(경정)';
    expect(statuteTitle('심판례-984358', decision)).toBe(decision);
    const ruling = '산림청 - 「임업ㆍ산림 공익기능 증진을 위한 법률 시행규칙」 제4조제1호의 의미';
    expect(statuteTitle('해석례-340535', ruling)).toBe(ruling);
  });

});
