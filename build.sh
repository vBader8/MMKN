#!/bin/sh
# يجهّز مجلد public للنشر (Cloudflare Pages: Build command = sh build.sh ، Output = public)
set -e
rm -rf public && mkdir -p public
cp -r index.html manifest.webmanifest _headers assets css js data public/
echo "public/ جاهز"
