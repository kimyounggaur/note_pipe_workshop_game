from pathlib import Path
root=Path(__file__).resolve().parent
parts=root/'parts'
scripts=['engine.js','curriculum.js','storage.js','view.js','audio.js','screens.js','audio-tests.js','app-tests.js','journey-tests.js','tests-ui.js','app.js']
missing=[name for name in scripts if not (parts/name).exists()]
scripts=[name for name in scripts if (parts/name).exists()]
css='\n'.join((parts/name).read_text() for name in ['style.css','screens.css','extra.css'] if (parts/name).exists())
js='\n'.join((parts/name).read_text() for name in scripts)
html='<!doctype html>\n<html lang="ko"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1,viewport-fit=cover"><meta name="theme-color" content="#14607c"><meta name="description" content="물길을 놓으며 붙임줄과 이음줄을 배우는 음악이론 게임. 7개 작업일, 49개 의뢰."><link rel="icon" href="data:,"><title>음표 파이프 공방 · 붙임줄과 이음줄</title><style>'+css+'</style></head><body>'+ (parts/'shell.html').read_text()+'<script>'+js+'</script></body></html>'
(root/'dist').mkdir(exist_ok=True)
(root/'dist/index.html').write_text(html)
(root/'index.html').write_text(html)
print(f'index.html: {len(html.encode()):,} bytes; zero external assets')
if missing: print('Pending optional parts:',', '.join(missing))
