from fastapi import APIRouter, HTTPException, Query
import requests
from bs4 import BeautifulSoup

router = APIRouter()


def _og_from_html(html: str):
    soup = BeautifulSoup(html, "html.parser")

    def meta(p: str):
        tag = soup.find("meta", property=p) or soup.find("meta", attrs={"name": p})
        return tag["content"] if tag and tag.has_attr("content") else None

    return {
        "title": meta("og:title") or (soup.title.string if soup.title else None),
        "description": meta("og:description"),
        "image": meta("og:image"),
    }


@router.get("/api/preview")
def preview(url: str = Query(..., description="Target URL")):
    try:
        r = requests.get(url, timeout=5, headers={"User-Agent": "Mozilla/5.0"})
        r.raise_for_status()
    except Exception as e:
        raise HTTPException(status_code=502, detail=f"fetch failed: {e}")
    data = _og_from_html(r.text)
    return data