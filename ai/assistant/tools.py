"""비서 도구. 백엔드 공개 API를 사용자 권한으로 읽는 얇은 래퍼이고, 도구 안에서는 LLM을 쓰지 않는다.

UUID는 턴 단위 별칭(g1 질문 그룹, t1 거래, c1 분류 그룹)으로 바꿔 모델에 준다. 모델은 긴 ID를 옮겨 적다 자주 틀린다.
응답은 필요한 필드만 골라 넘긴다. 수입·이름·이메일은 모델로 보내지 않는다(QR-7).
"""

import re
from datetime import date
from pathlib import Path
from urllib.error import HTTPError, URLError

import yaml

LIST_LIMIT = 20
SHOWN_TRANSACTIONS = 5
PAGE_SIZE = 100
MAX_PAGES = 10
STATUTE_CHARS = 600
WEEKDAYS = "월화수목금토일"
VERDICTS = {"가능": "AVAILABLE", "불가": "UNAVAILABLE", "확인 필요": "NEEDS_REVIEW"}
HELP: dict[str, str] = yaml.safe_load(Path(__file__).with_name("kb.yaml").read_text(encoding="utf-8"))
# rules/categories.yaml 의 사본이다. AI 이미지에는 rules/ 가 없다. 원본과 같은지 테스트가 대조한다.
CATEGORIES = [
    "카페", "음식점", "편의점", "온라인쇼핑", "음식배달", "해외SaaS", "국내SW", "통신", "수도광열", "여비교통", "차량",
    "도서", "교육", "광고", "사무용품", "의료", "금융", "지자체_과태료", "경찰청_범칙금", "조세", "PG_미상", "기타",
    "게임", "구독서비스", "여가", "미용", "생활용품", "임차료", "전자기기", "전문가수수료", "보험", "수리비",
]
# 이동 카드를 만들 수 있는 화면과 카드에 쓸 이름. 판정 실행(/run)은 판정 전 확인을 건너뛰므로 뺀다.
ROUTES = {"/upload": "카드내역", "/preview": "분류 확인", "/interview": "사업자 문진", "/confirm": "판정 전 확인",
          "/results": "결과", "/questions": "질문", "/summary": "요약", "/transactions": "거래", "/uploads": "업로드 이력"}
BULK_THRESHOLD = 5  # 질문 화면이 일괄 답변을 여는 기준과 같다(feature_f1_question_stack.md F1-c)
NOTE_CHARS = 300


class Reject(Exception):
    """도구가 요청을 거절한다. 예외가 아니라 결과로 돌려줘서 모델이 사유를 보고 고쳐 부르게 한다."""

    def __init__(self, error: str, message: str, **extra):
        super().__init__(error)
        self.result = {"error": error, "message": message, **extra}


def nullable(t: str, desc: str, enum: list | None = None) -> dict:
    d = {"type": [t, "null"], "description": desc}
    if enum:
        d["enum"] = enum + [None]
    return d


def schema(props: dict) -> dict:
    # strict 는 모든 속성이 required 이고 추가 속성이 없어야 한다. 선택 인자는 null 을 허용해서 표현한다.
    return {"type": "object", "properties": props, "required": list(props), "additionalProperties": False}


TOOL_DEFS: dict[str, tuple[str, dict]] = {
    "get_status": ("지금 업로드의 진행 상황과 다음 할 일을 가져온다.", {}),
    "list_questions": (
        "답하지 않은 질문 그룹과 각 그룹의 지난번 답(previous)을 가져온다. presumed_personal 이 true 면 소명 대기다.",
        {"merchant": nullable("string", "가맹점 이름 일부"), "date": nullable("string", "승인일 YYYY-MM-DD")},
    ),
    "find_transactions": (
        ("거래를 조건으로 찾는다. 건수(count)와 합계(sum)는 잘린 목록이 아니라 전체 기준으로 도구가 계산한다. "
         "around 에 거래 ref 를 주면 다른 조건은 무시하고 그 거래와 같은 날의 거래를 준다."),
        {
            "month": nullable("integer", "월 (1~12)"),
            "category": nullable("string", "카테고리. 예: 카페, 통신, 차량"),
            "merchant": nullable("string", "가맹점 이름 일부"),
            "verdict": nullable("string", "판정", list(VERDICTS)),
            "around": nullable("string", "거래 ref. 예: t3"),
        },
    ),
    "get_judgment": (
        "거래 하나의 판정 상세, 이 판정을 만든 답, 근거 조문 원문을 가져온다.",
        {"transaction": {"type": "string", "description": "거래 ref. 예: t6"}},
    ),
    "get_summary": (
        "판정별·계정별 합계와 남은 질문·미분류 집계를 가져온다.",
        {"scope": nullable("string", "batch=지금 업로드, year=귀속연도 전체. null 이면 지금 업로드", ["batch", "year"])},
    ),
    "list_unclassified": (
        "분류 확인을 기다리는 가맹점 그룹과 후보 카테고리(suggested)를 가져온다.",
        {"merchant": nullable("string", "가맹점 이름 일부")},
    ),
    "get_help": (
        "사용법·용어·서비스가 하지 않는 일 도움말을 가져온다. 청구내역이라 업로드가 막혔을 때도 이 도구로 안내한다.",
        {"topic": {"type": "string", "enum": list(HELP)}},
    ),
    "propose_answer": (
        "질문 답을 제안 카드로 만든다. 실행은 사용자가 [적용]을 눌러야 된다. 근거가 없으면 거절된다.",
        {"group": {"type": "string", "description": "질문 그룹 ref. 예: g1"},
         "value": {"type": "string", "description": "선택지 중 하나"},
         "basis": {"type": "string", "enum": ["user_said", "previous_answer"]},
         "quote": nullable("string", "basis=user_said 일 때 사용자 메시지에서 그대로 인용한 문장")},
    ),
    "propose_bulk_answer": (
        "남은 질문 중 같은 종류(fact_type)의 질문 전부에 같은 답을 넣는 카드를 만든다. 사용자가 전부 같은 답이라고 직접 말했을 때만 쓴다.",
        {"fact_type": {"type": "string", "description": "list_questions 의 fact_type"},
         "value": {"type": "string", "description": "선택지 중 하나"},
         "quote": {"type": "string", "description": "사용자 메시지에서 그대로 인용한 문장"}},
    ),
    "propose_classification": (
        "분류 확인을 기다리는 가맹점 그룹의 카테고리를 제안 카드로 만든다.",
        {"group": {"type": "string", "description": "분류 그룹 ref. 예: c1"},
         "category": {"type": "string", "enum": CATEGORIES},
         "basis": {"type": "string", "enum": ["user_said", "suggested_category"]},
         "quote": nullable("string", "basis=user_said 일 때 사용자 메시지에서 그대로 인용한 문장")},
    ),
    "propose_override": (
        ("사용자가 판정을 바꿔 달라고 하면 그 결정을 카드로 만든다. 판정을 바꾸는 것은 사용자의 결정이고 너는 카드만 만든다. "
         "질문이 남은 거래는 질문에 답하도록 돌린다."),
        {"transaction": {"type": "string", "description": "거래 ref. 예: t3"},
         "to_verdict": {"type": "string", "enum": list(VERDICTS)},
         "quote": {"type": "string", "description": "사용자 메시지에서 그대로 인용한 문장. 수정 사유로 저장된다"}},
    ),
    "add_handoff_note": (
        "세무대리인에게 물을 질문을 목록에 넣는 카드를 만든다. 세무 판단·비율·세액 질문을 받았을 때 쓴다.",
        {"text": {"type": "string", "description": "세무대리인에게 물을 질문 한두 문장"},
         "transactions": {"type": "array", "items": {"type": "string"}, "description": "관련 거래 ref. 없으면 빈 배열"},
         "quote": {"type": "string", "description": "사용자가 물은 문장 그대로"}},
    ),
    "propose_navigation": ("화면 이동 카드를 만든다.", {"route": {"type": "string", "enum": list(ROUTES)}}),
}
# 화면마다 9개 이하로 보여 준다. 도구가 많으면 모델이 고르기를 자주 틀린다.
COMMON_TOOLS = ["get_status", "get_help", "find_transactions", "get_judgment", "add_handoff_note", "propose_navigation"]
SCREEN_TOOLS = {
    "/questions": ["list_questions", "propose_answer", "propose_bulk_answer"],
    "/preview": ["list_unclassified", "propose_classification"],
    "/results": ["get_summary", "propose_override"],
}


def tools_for(screen: str | None) -> list[str]:
    root = "/" + (screen or "").strip("/").split("/")[0]
    return COMMON_TOOLS + SCREEN_TOOLS.get(root, ["get_summary"])


def tool_specs(names: list[str], strict: bool) -> list[dict]:
    out = []
    for name in names:
        desc, props = TOOL_DEFS[name]
        fn = {"name": name, "description": desc, "parameters": schema(props)}
        if strict:
            fn["strict"] = True
        out.append({"type": "function", "function": fn})
    return out


def day(iso: str) -> str:
    # 요일을 붙여 둔다. 사용자는 "토요일 스타벅스"처럼 요일로 말한다.
    return f"{iso}({WEEKDAYS[date.fromisoformat(iso).weekday()]})"


def pick(d: dict | None, *keys: str) -> dict | None:
    return None if d is None else {k: d.get(k) for k in keys}


def matches(text: str, t: dict) -> bool:
    return text.lower() in f"{t.get('merchantNorm') or ''} {t.get('merchantRaw') or ''}".lower()


def norm(s: str) -> str:
    # 공백·문장부호 차이(끝 마침표, 금액 쉼표 등)는 인용 대조에서 무시한다
    return re.sub(r"[\s.,!?~…'\"“”‘’]", "", s or "")


def identifies(t: dict, quote: str) -> bool:
    """인용 문장이 그 거래를 특정하는지. 날짜(9월 12일, 9/12, 12일)나 금액(12,800)이 들어 있어야 한다."""
    m, d = int(t["approvedAt"][5:7]), int(t["approvedAt"][8:10])
    keys = [f"{m}월{d}일", rf"{m}/{d}(?!\d)", f"{d}일", rf"{t['amount']}(?!\d)"]
    return any(re.search(rf"(?<!\d){k}", norm(quote)) for k in keys)


def names(t: dict, quote: str) -> bool:
    """인용 문장이 그 가맹점을 가리키는지. 정규화 이름이나 표기의 첫 낱말이 들어 있어야 한다."""
    # shortcut: 줄임말(한전)은 못 알아본다. 평가에서 자주 걸리면 가맹점 별칭을 둔다.
    q = norm(quote).lower()
    return any(n and norm(n).lower() in q for n in (t.get("merchantNorm"), (t.get("merchantRaw") or "").split(" ")[0]))


def target(transactions: list[dict], quote: str, presumed: bool = False) -> None:
    """사용자 말이 이 대상을 두고 한 말인지. "전부 개인" 같은 말을 건마다 붙이면 일괄 답 규칙을 우회한다."""
    if presumed:
        # 모델 판단에 맡기지 않고 코드로 막는다. 모델이 "토요일 스타벅스"를 여러 건에 붙이는 일이 있었다(8장).
        if not all(identifies(t, quote) for t in transactions):
            raise Reject("AMBIGUOUS_TARGET", "소명 대기 건은 인용 문장에 그 건의 날짜나 금액이 있어야 합니다. "
                                             "조건에 맞는 건이 여러 개면 제안하지 말고 사용자에게 어느 건인지 물어보세요.")
    elif not all(identifies(t, quote) or names(t, quote) for t in transactions):
        raise Reject("AMBIGUOUS_TARGET", "인용 문장에 그 가맹점 이름이나 날짜·금액이 있어야 합니다. "
                                         "남은 질문을 한꺼번에 말했다면 propose_bulk_answer 를 쓰고, 아니면 어느 건인지 물어보세요.")


def what(transactions: list[dict], total: int) -> str:
    """카드에 쓰는 대상 요약. 한 건이면 날짜와 금액, 여러 건이면 건수와 합계."""
    t = transactions[0]
    if len(transactions) == 1:
        return f"{t['merchantRaw'][:20]} {int(t['approvedAt'][5:7])}/{int(t['approvedAt'][8:10])} {t['amount']:,}원"
    return f"{t['merchantNorm'][:20]} {len(transactions)}건 {total:,}원"


class Turn:
    """대화 한 턴의 도구 실행. 별칭표, 근거 확인 기록, 받은 조문, 제안 카드를 턴이 끝날 때까지 들고 있는다."""

    def __init__(self, backend, context: dict, user_texts: list[str], tools: list[str]):
        self.be = backend
        self.batch = context.get("batchId")
        self.year = context.get("year")
        self.user_texts = user_texts
        self.tools = tools
        self.refs: dict[str, dict] = {}
        self._keys: dict[tuple[str, str], str] = {}
        self.tier_a: dict[str, str] = {}  # 지난번 답을 근거로 쓸 수 있는 그룹 ref → 그 값
        self.citations: list[str] = []
        self.proposals: list[dict] = []
        tid = context.get("transactionId")
        self.viewing = self._ref("t", tid, {"id": tid}) if tid else None

    def run(self, name: str, args: dict) -> dict:
        if name not in self.tools:
            return {"error": "UNKNOWN_TOOL", "message": f"이 화면에서 쓸 수 있는 도구: {', '.join(self.tools)}"}
        props = TOOL_DEFS[name][1]
        try:
            # strict 를 끈 모델은 인자를 빼거나 더 보낼 수 있다. 정의된 인자만 넘긴다.
            return getattr(self, name)(**{k: args.get(k) for k in props})
        except Reject as e:
            return e.result
        except HTTPError as e:
            return {"error": "BACKEND_ERROR", "status": e.code, "message": "백엔드가 요청을 거절했습니다. 다시 부르지 말고 사용자에게 알리세요."}
        except (URLError, TimeoutError):
            return {"error": "BACKEND_UNAVAILABLE", "message": "백엔드에 연결하지 못했습니다. 잠시 뒤 다시 시도하도록 안내하세요."}

    def _ref(self, prefix: str, key: str, obj: dict) -> str:
        ref = self._keys.get((prefix, key))
        if ref is None:
            ref = f"{prefix}{sum(p == prefix for p, _ in self._keys) + 1}"
            self._keys[(prefix, key)] = ref
        self.refs[ref] = obj
        return ref

    def _get(self, ref: str | None, prefix: str, what: str) -> dict:
        if not ref or not ref.startswith(prefix) or ref not in self.refs:
            raise Reject("UNKNOWN_REF", f"{ref} 는 이 턴에 받은 {what} ref 가 아닙니다. 조회 도구로 먼저 찾으세요.")
        return self.refs[ref]

    def _txn(self, t: dict) -> dict:
        # 거래 목록은 id, 질문·분류 그룹 안의 거래는 transactionId 로 거래를 가리킨다.
        tid = t.get("transactionId") or t["id"]
        ref = self._ref("t", tid, {**t, "id": tid})
        return {"ref": ref, "date": day(t["approvedAt"]), "merchant": t["merchantRaw"],
                "category": t.get("merchantCategory"), "amount": t["amount"]}

    def _pages(self, path: str, **params) -> tuple[list[dict], dict]:
        """전부 읽어 온다. 마지막 응답도 돌려줘서 집계(unresolved)와 잘림(hasNext)을 보게 한다."""
        items: list[dict] = []
        for page in range(MAX_PAGES):
            res = self.be.get(path, page=page, size=PAGE_SIZE, **params)
            items += res["items"]
            if not res["page"].get("hasNext"):
                break
        # shortcut: 1,000건(100 × 10쪽)까지만 읽는다. 넘는 사용자가 생기면 백엔드에 검색·합계 필터를 추가한다.
        return items, res

    # ── 조회 도구 ────────────────────────────────────────────────
    def get_status(self) -> dict:
        p = self.be.get("/progress", batchId=self.batch)
        return {
            "batch": pick(p.get("batch"), "label", "transactionCount"),
            "context": pick(p.get("context"), "bookkeeping", "hasEmployee"),
            "classification": pick(p.get("classification"), "pendingCount", "pendingAmount"),
            "run": pick(p.get("run"), "status"),
            "questions": pick(p.get("questions"), "pendingCount", "pendingAmount", "fillableFromPrevious"),
            "next": pick(p.get("next"), "step", "route", "label"),
        }

    def list_questions(self, merchant: str | None, date: str | None) -> dict:
        groups, res = self._pages("/questions", batchId=self.batch, status="PENDING", grouped="true")
        try:
            suggestions = self.be.get("/questions/suggestions", batchId=self.batch)["items"]
            prev_of = {(s["groupKey"], s["factType"]): s for s in suggestions}
        except (HTTPError, URLError):
            prev_of = None  # 지난번 답이 없어도 질문 목록과 말로 답하기는 된다
        rows = [g for g in groups
                if (not merchant or any(matches(merchant, t) for t in g["transactions"]))
                and (not date or any(t["approvedAt"] == date for t in g["transactions"]))]
        out = []
        for g in rows[:LIST_LIMIT]:
            ref = self._ref("g", f"{g['groupKey']}|{g['factType']}", g)
            s = (prev_of or {}).get((g["groupKey"], g["factType"]))
            prev = s and {k: v for k, v in pick(s, "tier", "value", "sourceLabel", "conflict", "history",
                                                "historyCounts", "reason").items() if v not in (None, False)}
            if s and s.get("tier") == "A" and not s.get("conflict") and s.get("value") in g["options"]:
                self.tier_a[ref] = s["value"]
            out.append({
                "ref": ref, "merchant": g["transactions"][0]["merchantNorm"], "fact_type": g["factType"],
                "question": g["questionText"], "options": g["options"],
                # 대기 그룹의 bulkAnswerable=false 는 소명 대기 거래의 질문이 섞였다는 뜻이다(api.md 3.9).
                "presumed_personal": not g["bulkAnswerable"],
                "count": g["count"], "total_amount": g["totalAmount"],
                "transactions": [self._txn(t) for t in g["transactions"][:SHOWN_TRANSACTIONS]],
                "previous": prev,
            })
        result = {"unresolved": res["unresolved"], "total_groups": len(rows), "groups": out}
        if prev_of is None:
            result["previous_unavailable"] = True
        return result

    def find_transactions(self, month, category, merchant, verdict, around) -> dict:
        if around:
            base = self.be.get(f"/transactions/{self._get(around, 't', '거래')['id']}")
            items, res = self._pages("/transactions", batchId=base["batchId"])
            rows = [x for x in items if x["approvedAt"] == base["approvedAt"]]
        else:
            month = int(month) if month else None
            # 월은 여러 카드사 업로드에 걸치므로 연·월로 찾는다. 연도를 모르면 지금 업로드에서 월로 거른다.
            scope = {"year": self.year, "month": month} if month and self.year else {"batchId": self.batch}
            items, res = self._pages("/transactions", status="JUDGEABLE", verdict=VERDICTS.get(verdict), **scope)
            rows = [x for x in items
                    if (not month or int(x["approvedAt"][5:7]) == month)
                    and (not category or category in (x.get("merchantCategory") or ""))
                    and (not merchant or matches(merchant, x))]
        out = {"count": len(rows), "sum": sum(x["amount"] for x in rows), "items": [self._txn(x) for x in rows[:LIST_LIMIT]]}
        if res["page"].get("hasNext"):
            out["truncated"] = "거래가 많아 앞의 1,000건만 셌습니다"
        return out

    def get_judgment(self, transaction: str) -> dict:
        tid = self._get(transaction, "t", "거래")["id"]
        items = self.be.get("/judgments", transactionId=tid)["items"]
        if not items:
            raise Reject("NO_JUDGMENT", "이 거래는 아직 판정이 없습니다.")
        j = items[0]
        answered = self.be.get("/questions", transactionId=tid, status="ANSWERED")["items"]
        citations = []
        for c in j.get("citations") or []:
            s = self.be.get(f"/statutes/{c['statuteVersionId']}")
            self.citations.append(s["title"])
            citations.append({"title": s["title"], "hierarchy": s["hierarchy"], "body": s["body"][:STATUTE_CHARS]})
        tx = j["transaction"]
        return {
            "transaction": {"date": day(tx["approvedAt"]), "merchant": tx["merchantRaw"],
                            "category": tx["merchantCategory"], "amount": tx["amount"]},
            "verdict": j["verdict"]["label"], "out_of_scope": j["outOfScope"],
            "account": j.get("account"), "final_amount": j.get("finalAmount"),
            "rule_card": j.get("ruleCardId"), "explanation": j.get("explanation"),
            "answers": [{"question": q["questionText"], "answer": (q.get("answer") or {}).get("value")} for q in answered],
            "citations": citations,
        }

    def get_summary(self, scope: str | None) -> dict:
        by_year = scope == "year" or not self.batch
        s = self.be.get("/judgments/summary", **({"year": self.year} if by_year else {"batchId": self.batch}))
        # shortcut: 질문·분류 조회에 연도 필터가 없어 연도 범위의 미해소는 사용자 전체 업로드 기준이다. 연도 필터가 생기면 바꾼다.
        batch = None if by_year else self.batch
        questions = self.be.get("/questions", batchId=batch, size=1)
        reviews = self.be.get("/classification-reviews", batchId=batch, size=1)
        label = {v: k for k, v in VERDICTS.items()}
        return {
            "scope": "year" if by_year else "batch", "total_count": s["totalCount"],
            "by_verdict": {label[k]: v for k, v in s["byVerdict"].items()},
            "by_account": s["byAccount"][:LIST_LIMIT],
            "unresolved_questions": questions["unresolved"], "unclassified": reviews["unresolved"],
        }

    def list_unclassified(self, merchant: str | None) -> dict:
        groups, res = self._pages("/classification-reviews", batchId=self.batch, status="PENDING", grouped="true")
        rows = [g for g in groups if not merchant or any(matches(merchant, t) for t in g["transactions"])]
        return {"unresolved": res["unresolved"], "total_groups": len(rows), "groups": [
            {"ref": self._ref("c", g["groupKey"], g), "merchant": g["merchantNorm"], "count": g["count"],
             "total_amount": g["totalAmount"], "suggested": g["suggestedCategories"],
             "transactions": [self._txn(t) for t in g["transactions"][:SHOWN_TRANSACTIONS]]}
            for g in rows[:LIST_LIMIT]]}

    def get_help(self, topic: str) -> dict:
        if topic not in HELP:
            raise Reject("UNKNOWN_TOPIC", "없는 주제입니다.", topics=list(HELP))
        return {"topic": topic, "text": HELP[topic]}

    # ── 제안 도구: 카드만 만들고 실행하지 않는다. 사용자가 [적용]을 눌러야 기존 API로 실행된다 ──
    def _check_quote(self, quote: str | None) -> None:
        q = norm(quote or "")
        if not q or not any(q in norm(u) for u in self.user_texts):
            raise Reject("QUOTE_NOT_FOUND", "quote 가 사용자 메시지에 그대로 없습니다. 사용자가 한 말을 그대로 인용하세요.")

    def _propose(self, card: dict) -> dict:
        self.proposals.append(card)
        return {"status": "proposed", "card": card["card"]}

    def propose_answer(self, group: str, value: str, basis: str, quote: str | None) -> dict:
        g = self._get(group, "g", "질문 그룹")
        if value not in g["options"]:
            raise Reject("INVALID_OPTION", "선택지에 없는 값입니다.", allowed=g["options"])
        presumed = not g["bulkAnswerable"]
        if basis == "previous_answer":
            if presumed:
                raise Reject("NEEDS_USER_STATEMENT", "소명 대기 질문은 사용자가 직접 말한 사정만 근거가 됩니다.")
            if self.tier_a.get(group) != value:
                raise Reject("NO_BASIS", "이 질문은 지난번 답으로 채울 수 없습니다. "
                                         "list_questions 의 previous 가 A등급이고 충돌이 없을 때 그 값으로만 됩니다.")
        elif basis == "user_said":
            self._check_quote(quote)
            target(g["transactions"], quote, presumed)
        else:
            raise Reject("NO_BASIS", "basis 는 user_said 나 previous_answer 여야 합니다.")
        return self._propose({"kind": "answer", "questionIds": g["questionIds"], "value": value,
                              "source": "PREVIOUS_ANSWER" if basis == "previous_answer" else "ASSISTANT",
                              "card": f"{what(g['transactions'], g['totalAmount'])} → '{value}'"})

    def propose_bulk_answer(self, fact_type: str, value: str, quote: str) -> dict:
        self._check_quote(quote)
        if not self.batch:
            raise Reject("NO_BATCH", "지금 업로드가 정해지지 않아 일괄 답을 만들 수 없습니다.")
        groups, _ = self._pages("/questions", batchId=self.batch, status="PENDING", grouped="true")
        # 질문 화면의 일괄 답변 규칙을 그대로 따른다. 첫 화면부터 전부 닫아 버리지 않게 한다.
        if len(groups) > BULK_THRESHOLD:
            raise Reject("BULK_NOT_YET", f"남은 질문 그룹이 {len(groups)}개입니다. {BULK_THRESHOLD}개 이하일 때만 한 번에 답합니다. "
                                         "하나씩 답하도록 안내하세요.")
        targets = [g for g in groups if g["factType"] == fact_type]
        if not targets:
            raise Reject("NOTHING_TO_ANSWER", "이 종류의 남은 질문이 없습니다.", fact_types=sorted({g["factType"] for g in groups}))
        if any(not g["bulkAnswerable"] for g in targets):
            raise Reject("PRESUMED_MIXED", "소명 대기 질문이 섞인 종류라 한 번에 답할 수 없습니다. 건마다 답하도록 안내하세요.")
        if len(targets) == 1:
            raise Reject("USE_ANSWER", "이 종류의 남은 질문은 하나입니다. list_questions 로 찾아 propose_answer 를 쓰세요.")
        common = [o for o in targets[0]["options"] if all(o in g["options"] for g in targets)]
        if value not in common:
            raise Reject("INVALID_OPTION", "이 종류의 질문 모두가 받는 선택지가 아닙니다.", allowed=common)
        count, amount = sum(g["count"] for g in targets), sum(g["totalAmount"] for g in targets)
        return self._propose({"kind": "bulk_answer", "batchId": self.batch, "factType": fact_type, "value": value,
                              "card": f"남은 '{fact_type}' 질문 {count}건 {amount:,}원 → '{value}'"})

    def propose_classification(self, group: str, category: str, basis: str, quote: str | None) -> dict:
        g = self._get(group, "c", "분류 그룹")
        if category not in CATEGORIES:
            raise Reject("INVALID_CATEGORY", "없는 카테고리입니다.", allowed=CATEGORIES)
        if basis == "suggested_category":
            if category not in g["suggestedCategories"]:
                raise Reject("NO_BASIS", "후보 카테고리 밖입니다. 사용자가 직접 설명했을 때만 user_said 로 제안하세요.",
                             suggested=g["suggestedCategories"])
        elif basis == "user_said":
            self._check_quote(quote)
            target(g["transactions"], quote)
        else:
            raise Reject("NO_BASIS", "basis 는 user_said 나 suggested_category 여야 합니다.")
        return self._propose({"kind": "classification", "reviewIds": g["reviewIds"], "merchantCategory": category,
                              "card": f"{what(g['transactions'], g['totalAmount'])} → {category}"})

    def propose_override(self, transaction: str, to_verdict: str, quote: str) -> dict:
        self._check_quote(quote)
        tid = self._get(transaction, "t", "거래")["id"]
        if to_verdict not in VERDICTS:
            raise Reject("INVALID_VERDICT", "없는 판정입니다.", allowed=list(VERDICTS))
        if self.be.get("/questions", transactionId=tid, status="PENDING")["items"]:
            raise Reject("USE_QUESTION", "이 거래에는 답하지 않은 질문이 있습니다. 판정을 바꾸지 말고 질문에 답하도록 "
                                         "질문 화면 이동을 제안하세요.")
        items = self.be.get("/judgments", transactionId=tid)["items"]
        if not items:
            raise Reject("NO_JUDGMENT", "이 거래는 아직 판정이 없습니다.")
        j, tx = items[0], items[0]["transaction"]
        target([tx], quote)
        if j["verdict"]["code"] == VERDICTS[to_verdict]:
            raise Reject("SAME_VERDICT", f"이미 {to_verdict} 판정입니다.")
        return self._propose({"kind": "override", "judgmentId": j["id"], "toVerdict": VERDICTS[to_verdict],
                              "reason": quote.strip(),
                              "card": f"{what([tx], tx['amount'])} 판정 {j['verdict']['label']} → {to_verdict}"})

    def add_handoff_note(self, text: str, transactions: list[str] | None, quote: str) -> dict:
        self._check_quote(quote)
        text = (text or "").strip()
        if not text or len(text) > NOTE_CHARS:
            raise Reject("BAD_TEXT", f"질문은 1~{NOTE_CHARS}자로 쓰세요.")
        ids = [self._get(r, "t", "거래")["id"] for r in transactions or []]
        return self._propose({"kind": "handoff_note", "text": text, "transactionIds": ids,
                              "card": f"세무대리인 질문 추가: {text}"})

    def propose_navigation(self, route: str) -> dict:
        if route not in ROUTES:
            raise Reject("INVALID_ROUTE", "없는 화면입니다.", allowed=list(ROUTES))
        return self._propose({"kind": "navigation", "route": route, "card": f"{ROUTES[route]} 화면으로 이동"})
