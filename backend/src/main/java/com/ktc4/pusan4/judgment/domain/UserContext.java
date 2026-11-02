package com.ktc4.pusan4.judgment.domain;

public record UserContext(String industryCode, boolean hasEmployee, Integer homeOfficeRatio) {

    /** 자택 겸용 안분에 쓸 비율이 있는가. 문진의 자택 작업 "아니오" 는 0 으로 저장되어 null 과 같이 본다. */
    public boolean hasHomeOfficeRatio() {
        return homeOfficeRatio != null && homeOfficeRatio > 0;
    }
}
