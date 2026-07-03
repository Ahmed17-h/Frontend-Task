import json, urllib.request
url='http://linkvaultapi.runasp.net/swagger/v1/swagger.json'
with urllib.request.urlopen(url, timeout=20) as r:
    data=json.load(r)
print(data['info']['title'])
for p in ['/api/auth/register','/api/auth/login','/api/auth/me','/api/categories','/api/bookmarks','/api/notes']:
    print('\nPATH', p)
    print(json.dumps(data['paths'].get(p, {}), indent=2)[:6000])
