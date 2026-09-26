package com.ktc4.pusan4.shared.api;

/**
 * 스웨거 설명에 반복해서 쓰는 문구.
 */
public final class ContractNotes {

    /**
     * api.md 에 응답 필드가 적혀 있지 않은 자리. 형태를 지어내지 않고 object 로 둔다.
     */
    public static final String SHAPE_UNSPECIFIED =
        "응답 필드가 api.md 에 적혀 있지 않아 형태를 정하지 않았다 (api.md 확정 후 반영)";

    private ContractNotes() {
    }
}
