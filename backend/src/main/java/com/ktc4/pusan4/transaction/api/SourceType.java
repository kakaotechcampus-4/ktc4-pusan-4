package com.ktc4.pusan4.transaction.api;

/**
 * 소스 유형 (api.md 2.11). 업로드에서 허용되는 값은 현재 승인내역뿐이고, 나머지는 422 INVALID_SOURCE_TYPE.
 */
public enum SourceType {
    승인내역,
    청구내역,
    판별불가
}
