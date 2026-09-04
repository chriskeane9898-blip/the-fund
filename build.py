import sys

with open('style_and_head_extra.html') as f:
    style_head = f.read()
with open('body_markup.html') as f:
    body_markup = f.read()
with open('emblem_b64.txt') as f:
    b64 = f.read().strip()
with open('logic_supabase.js') as f:
    logic = f.read()

body_markup = body_markup.replace('__LOGO_B64__', b64)

SUPABASE_JS_CDN = '<script src="https://cdn.jsdelivr.net/npm/@supabase/supabase-js@2"></script>\n'

doc = (
    '<!doctype html>\n<html lang="en">\n<head>\n'
    '<meta charset="utf-8">\n'
    '<meta name="viewport" content="width=device-width, initial-scale=1">\n'
    + style_head +
    '\n</head>\n<body>\n'
    + body_markup +
    '\n' + SUPABASE_JS_CDN +
    '<script>\n' + logic + '\n</script>\n'
    '</body>\n</html>\n'
)

with open('index.html', 'w') as f:
    f.write(doc)

print('wrote index.html:', len(doc), 'chars')
