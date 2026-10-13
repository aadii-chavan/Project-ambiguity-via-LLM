from fastapi import FastAPI
from fastapi.testclient import TestClient

from app.static import mount_frontend


def make(tmp_path):
    (tmp_path / "assets").mkdir()
    (tmp_path / "index.html").write_text("<html>SPA</html>")
    (tmp_path / "assets" / "app.js").write_text("console.log(1)")
    (tmp_path.parent / "secret.txt").write_text("TOP SECRET")
    app = FastAPI()

    @app.get("/api/ping")
    def ping():
        return {"ok": True}

    assert mount_frontend(app, tmp_path)
    return TestClient(app)


def test_noop_without_build(tmp_path):
    assert mount_frontend(FastAPI(), tmp_path / "missing") is False


def test_spa_fallback_assets_and_api_precedence(tmp_path):
    c = make(tmp_path)
    assert "SPA" in c.get("/").text
    assert "SPA" in c.get("/requirements/abc123").text          # client-side route
    assert c.get("/assets/app.js").text == "console.log(1)"
    assert c.get("/api/ping").json() == {"ok": True}              # real API route wins
    assert c.get("/api/does-not-exist").status_code == 404        # API 404s stay JSON, not index.html
    assert c.get("/health").status_code == 404                    # (not defined in this mini app)


def test_path_traversal_is_blocked(tmp_path):
    c = make(tmp_path)
    for p in ("/../secret.txt", "/%2e%2e/secret.txt", "/assets/../../secret.txt", "/..%2fsecret.txt"):
        assert "TOP SECRET" not in c.get(p).text


def test_cache_headers_so_updates_are_picked_up(tmp_path):
    c = make(tmp_path)
    assert c.get("/").headers["cache-control"] == "no-cache"                          # entry page revalidates
    assert c.get("/requirements/abc").headers["cache-control"] == "no-cache"
    assert "immutable" in c.get("/assets/app.js").headers["cache-control"]            # hashed assets cache forever
