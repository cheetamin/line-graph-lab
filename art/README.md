# 동양풍 그림 원본

`public/assets/art/`의 PNG(버튼·책갈피·편액·아이콘·낙관·붓·벼루·청사초롱·소나무·매화·학·정자·산수·옛 책·구름·책등)는
모두 이 폴더의 파이썬 코드로 직접 그린 SVG를 투명 배경 PNG로 구운 것입니다(외부 그림을 잘라 쓰지 않음).

- `defs.py` 먹 번짐·마른 붓·한지 결 필터, 여의두(구름 머리) 무늬
- `ui_art.py` 버튼(주칠·청록·금·한지·비활성), 편액, 책갈피, 도구 타일, 화살표, 쪽 표시
- `icon_art.py` 아이콘 10종과 낙관(封·完·展·待·表)
- `prop_art.py` 소품과 풍경

다시 굽기: `python3 art/render.py` (특정 그림만: `python3 art/render.py prop_crane btn_red`)
— Python Playwright와 Chromium이 필요합니다.
