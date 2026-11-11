"""Optional network boundaries. No learner data is included in source searches."""
import html
import os
from datetime import timedelta
from urllib.parse import urlparse
import httpx
from .database import get, put, group, now

def configuration():
    return {"retrieval": os.getenv("QUESTION_PROVIDER","off").lower()=="stackexchange",
            "ai": bool(os.getenv("AI_BASE_URL") and os.getenv("AI_MODEL"))}

def refresh(db, topic):
    existing = [v for v in group(db,"source").values() if v["topic"]==topic["id"]]
    if not configuration()["retrieval"]:
        return {"message":"Online retrieval is off. Local practice and cached sources are available. Enable Stack Exchange in .env to fetch questions.","sources":existing}
    until = get(db,"provider","stackexchange",{}).get("retryAfter",0)
    if now().timestamp() < until:
        return {"message":"The provider requested a pause. Cached questions are available.","sources":existing}
    term = {"strings":"python string","variables":"python variables","python-fundamentals":"python beginner","oop":"python class"}.get(topic["id"], topic["title"])
    params = {"site":"stackoverflow","q":term,"sort":"creation","order":"desc","pagesize":12,"fromdate":int((now()-timedelta(days=365)).timestamp())}
    if os.getenv("STACKEXCHANGE_KEY"): params["key"] = os.environ["STACKEXCHANGE_KEY"]
    try:
        response = httpx.get("https://api.stackexchange.com/2.3/search/advanced",params=params,timeout=10)
        response.raise_for_status()
        payload = response.json()
        if "items" not in payload: raise ValueError("Missing question list")
        if payload.get("backoff") or payload.get("quota_remaining")==0:
            wait = max(payload.get("backoff",0),86400 if payload.get("quota_remaining")==0 else 0)
            put(db,"provider","stackexchange",{"retryAfter":now().timestamp()+wait})
        added = 0
        for item in payload["items"]:
            key = f'{topic["id"]}-{item["question_id"]}'
            if get(db,"source",key): continue
            tags = item.get("tags",[])
            source = {"topic":topic["id"],"title":html.unescape(item["title"]), "url":item["link"],"author":html.unescape(item["owner"].get("display_name","Stack Overflow contributor")),
                    "retrieved":now().isoformat(),"published":item["creation_date"], "license":item.get("content_license","See source"),"tags":tags,"difficulty":"Intermediate" if len(tags)>2 else "Beginner","kind":"Sourced discussion"}
            put(db,"source",key,source)
            existing.insert(0,source)
            added += 1
        return {"message":f"Fetched {added} new source links. {len(existing)} cached for this topic.","sources":existing}
    except (httpx.HTTPError, ValueError, KeyError, TypeError):
        return {"message":"The question provider is unavailable. Local practice and previously cached questions are available.","sources":existing}

def coach(attempt):
    if not configuration()["ai"]: return {"message":"Optional AI coaching is off. Your scored concept review is available below."}
    base = os.environ["AI_BASE_URL"].rstrip("/")
    url = urlparse(base)
    if url.scheme != "https" and not (url.scheme=="http" and url.hostname in ("localhost","127.0.0.1","::1")):
        return {"message":"Use HTTPS or a loopback URL for the configured AI provider."}
    headers = {}
    if os.getenv("AI_API_KEY"): headers["Authorization"] = "Bearer "+os.environ["AI_API_KEY"]
    body = {"model":os.environ["AI_MODEL"],"messages":[{"role":"system","content":"Give two brief, concrete study exercises in plain text based on these assessed concepts. The score is final."},{"role":"user","content":str({"topic":attempt["topic"],"score":attempt["score"],"concepts":attempt["concepts"]})}],"max_tokens":350}
    try:
        res = httpx.post(base+"/chat/completions",json=body,headers=headers,timeout=20)
        res.raise_for_status()
        msg = res.json()["choices"][0]["message"]["content"]
        if not isinstance(msg,str) or not msg.strip(): raise ValueError()
        return {"message":msg[:4000],"generated":True}
    except (httpx.HTTPError, KeyError, IndexError, ValueError,TypeError):
        return {"message":"AI coaching is unavailable. Your local score and revision plan are saved."}

