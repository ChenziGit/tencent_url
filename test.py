import app
import requests
import json

qm = app.QQMusic()
url = "https://u.y.qq.com/cgi-bin/musicu.fcg"

payload = {
    "req_1": {
        "method": "DoSearchForQQMusicDesktop",
        "module": "music.search.SearchCgiService",
        "param": {
            "num_per_page": 10,
            "page_num": 1,
            "query": "周杰伦",
            "search_type": 3 
        }
    }
}

r = requests.post(url, json=payload, headers=qm.headers)
with open('out.json', 'w', encoding='utf-8') as f:
    json.dump(r.json(), f, ensure_ascii=False, indent=2)

print("Wrote search results to out.json")
