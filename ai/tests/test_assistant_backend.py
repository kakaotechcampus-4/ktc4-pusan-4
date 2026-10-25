import io

from assistant import backend


def test_get_forwards_token_and_drops_empty_params(monkeypatch):
    seen = {}

    def fake_urlopen(req, timeout):
        seen["url"], seen["auth"], seen["timeout"] = req.full_url, req.get_header("Authorization"), timeout
        return io.BytesIO(b'{"items": []}')

    monkeypatch.setattr(backend, "urlopen", fake_urlopen)
    out = backend.BackendClient("Bearer tok", "http://be/api/v1/").get("/transactions", batchId="b-1", month=None, page=0)

    assert out == {"items": []}
    assert seen == {"url": "http://be/api/v1/transactions?batchId=b-1&page=0", "auth": "Bearer tok", "timeout": 5}
