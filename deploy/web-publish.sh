#!/bin/sh
# /dist(새 화면 파일)를 Caddy 가 내는 /srv(web-dist 볼륨)로 옮긴다. web 이미지의 CMD 로 deploy.sh 가 돌린다.
# - 옛 파일은 지우지 않는다. 이미 화면을 연 브라우저가 옛 해시 청크(/assets/*)를 이어서 부른다.
# - 파일마다 임시 이름으로 쓴 뒤 mv 로 바꿔, Caddy 가 반쯤 쓴 파일을 내지 않게 한다.
# - HTML 은 마지막에 바꾼다. 새 HTML 이 가리키는 파일이 모두 들어간 뒤여야 한다.
set -eu

put() {
    mkdir -p "/srv/$(dirname "$1")"
    cp "/dist/$1" "/srv/$1.tmp"
    mv "/srv/$1.tmp" "/srv/$1"
}

cd /dist
find . -type f ! -name '*.html' | while read -r f; do put "$f"; done
find . -type f -name '*.html' | while read -r f; do put "$f"; done
echo "published $(find . -type f | wc -l) files"
