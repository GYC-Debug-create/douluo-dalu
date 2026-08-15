# -*- coding: utf-8 -*-
"""README.md -> 自包含 HTML（图片 base64 内嵌，mermaid 转静态 HTML 图）"""
import re, base64, os

SRC = 'docs/项目说明书/README.md'
OUT = 'C:/Temp/douluo-doc.html'
DOC = 'docs/项目说明书'

lines = open(SRC, encoding='utf-8').read().split('\n')
out = []
i = 0

# ---- 三个 mermaid 块的静态 HTML 片段（按出现顺序 1/2/3）----
FLOW = '''
<div class="flow">
  <div class="fcard"><b>觉醒期 1~10 级</b><span>武魂觉醒 · 初识世界</span></div><div class="farrow">→</div>
  <div class="fcard"><b>进阶学院 10~40 级</b><span>入学 · 魂师大赛</span></div><div class="farrow">→</div>
  <div class="fcard"><b>历练期 40~70 级</b><span>猎环 · 战斗 · 游历</span></div><div class="farrow">→</div>
  <div class="fcard"><b>封神期 70~100 级</b><span>海神九考 · 讨伐武魂殿</span></div>
</div>'''

ARCH = '''
<div class="arch">
  <div class="abox"><div class="atag">客户端 · 手机/平板/桌面</div>
    <div class="ainner">Vue 3 + Pinia + Vue Router<br><span class="dim">事件引擎 / 战斗系统 / 地图桥接</span></div>
    <div class="ainner">legacy 兼容页<br><span class="dim">game.html / map.html / codex.html</span></div>
  </div>
  <div class="aarrow">↓ HTTP :80 /douluo/</div>
  <div class="abox"><div class="atag">云服务器 49.233.157.164</div>
    <div class="ainner">Nginx :80 反向代理 <span class="dim">（gzip + 路由）</span></div>
    <div class="aarrow2">↓ proxy 127.0.0.1:3001</div>
    <div class="ainner boxed">Docker 容器 douluo-game-app<br>
      <span class="dim">Express server.js :3000</span><br>
      <span class="dim">Token 鉴权 · 乐观锁 · 限流 · 存档 API</span><br>
      <span class="dim">静态资源 frontend/dist（Vue 构建 + public）</span></div>
    <div class="aarrow2">↓</div>
    <div class="ainner">存档卷 douluo-data</div>
  </div>
</div>'''

TOPOLOGY = '''
<div class="flow">
  <div class="fcard"><b>玩家浏览器</b><span>http://49.233.157.164/douluo/</span></div><div class="farrow">→</div>
  <div class="fcard"><b>Nginx :80</b><span>反向代理</span></div><div class="farrow">→</div>
  <div class="fcard"><b>Docker</b><span>douluo-game-app<br>127.0.0.1:3001</span></div><div class="farrow">→</div>
  <div class="fcard"><b>存档卷</b><span>douluo-data</span></div>
</div>'''

MERMAID_HTML = [FLOW, ARCH, TOPOLOGY]
mer_id = 0

def inline(s):
    s = s.replace('&', '&amp;').replace('<', '&lt;').replace('>', '&gt;')
    s = re.sub(r'`([^`]+)`', r'<code>\1</code>', s)
    s = re.sub(r'\*\*([^*]+)\*\*', r'<b>\1</b>', s)
    return s

def b64img(path):
    with open(os.path.join(DOC, path), 'rb') as f:
        return 'data:image/jpeg;base64,' + base64.b64encode(f.read()).decode()

while i < len(lines):
    ln = lines[i]
    if ln.startswith('```'):
        # 收集代码块
        is_mermaid = ln.startswith('```mermaid')
        block = []
        i += 1
        while i < len(lines) and not lines[i].startswith('```'):
            block.append(lines[i]); i += 1
        i += 1  # 跳过结束 ```
        code = '\n'.join(block)
        if is_mermaid:
            out.append(MERMAID_HTML[mer_id]); mer_id += 1
        else:
            out.append('<pre>' + inline(code) + '</pre>')
        continue
    if ln.startswith('#'):
        m = re.match(r'(#+)\s*(.*)', ln)
        lv = len(m.group(1))
        out.append(f'<h{lv}>{inline(m.group(2))}</h{lv}>')
    elif ln.startswith('!['):
        m = re.match(r'!\[([^\]]*)\]\(([^)]+)\)', ln)
        cap, path = m.group(1), m.group(2)
        out.append(f'<figure><img src="{b64img(path)}" alt="{cap}"/><figcaption>{cap}</figcaption></figure>')
    elif ln.startswith('>'):
        out.append(f'<blockquote>{inline(ln[1:].strip())}</blockquote>')
    elif ln.strip() == '---':
        out.append('<hr/>')
    elif re.match(r'^\s*[-*]\s', ln):
        items = []
        while i < len(lines) and re.match(r'^\s*[-*]\s', lines[i]):
            t = re.sub(r'^\s*[-*]\s*', '', lines[i])
            t = re.sub(r'\[( |x)\]', lambda m: '☐' if m.group(1)==' ' else '☑', t)
            items.append(f'<li>{inline(t)}</li>'); i += 1
        out.append('<ul>' + ''.join(items) + '</ul>')
        continue
    elif ln.startswith('|') and i + 1 < len(lines) and re.match(r'^\|[\s:\-|]+\|$', lines[i+1]):
        # 表格
        head = [c.strip() for c in ln.strip('|').split('|')]
        i += 2
        rows = []
        while i < len(lines) and lines[i].startswith('|'):
            rows.append([inline(c.strip()) for c in lines[i].strip('|').split('|')]); i += 1
        out.append('<table><thead><tr>' + ''.join(f'<th>{h}</th>' for h in head) + '</tr></thead><tbody>' +
                   ''.join('<tr>' + ''.join(f'<td>{c}</td>' for c in r) + '</tr>' for r in rows) + '</tbody></table>')
        continue
    elif ln.strip() == '':
        pass
    else:
        out.append(f'<p>{inline(ln)}</p>')
    i += 1

body = '\n'.join(out)
html = f'''<!DOCTYPE html><html lang="zh"><head><meta charset="utf-8"/>
<title>斗罗大陆 · 魂师之路 项目说明书</title>
<style>
  @page {{ size: A4; margin: 14mm 12mm; }}
  body {{ font-family: "Noto Serif SC","Microsoft YaHei",SimSun,serif; color:#241c10; line-height:1.75; margin:0; }}
  h1 {{ color:#7a5b1e; border-bottom:3px double #c9a84c; padding-bottom:8px; font-size:26px; }}
  h2 {{ color:#7a5b1e; border-left:5px solid #c9a84c; padding-left:10px; margin-top:26px; font-size:20px; }}
  h3 {{ color:#5a4a2a; font-size:16px; }}
  table {{ border-collapse:collapse; width:100%; margin:10px 0; font-size:13px; }}
  th {{ background:#f3ead2; border:1px solid #c9b98a; padding:6px 8px; text-align:left; }}
  td {{ border:1px solid #d8ccaa; padding:5px 8px; }}
  code {{ background:#f4efdf; border:1px solid #ddd0a8; border-radius:3px; padding:0 4px; font-size:12px; }}
  pre {{ background:#2a2416; color:#e8dcc0; padding:10px; border-radius:6px; font-size:12px; overflow:hidden; }}
  blockquote {{ border-left:4px solid #c9a84c; background:#faf6e8; margin:8px 0; padding:6px 12px; }}
  figure {{ margin:12px 0; text-align:center; page-break-inside:avoid; }}
  figure img {{ max-width:92%; border:1px solid #d8ccaa; border-radius:6px; }}
  figcaption {{ font-size:12px; color:#8a7a50; margin-top:4px; }}
  ul {{ padding-left:22px; }}
  hr {{ border:none; border-top:1px solid #d8ccaa; margin:18px 0; }}
  /* 流程图 */
  .flow {{ display:flex; align-items:stretch; gap:6px; margin:12px 0; page-break-inside:avoid; }}
  .fcard {{ flex:1; border:1px solid #c9a84c; border-radius:8px; background:#faf6e8; padding:8px 10px; text-align:center; }}
  .fcard b {{ display:block; color:#7a5b1e; font-size:14px; }}
  .fcard span {{ font-size:12px; color:#6a5c3a; }}
  .farrow {{ align-self:center; color:#c9a84c; font-size:20px; font-weight:bold; }}
  /* 架构图 */
  .arch {{ margin:12px 0; page-break-inside:avoid; }}
  .abox {{ border:2px solid #7a5b1e; border-radius:8px; padding:8px; margin:6px 0; background:#fbf7ec; }}
  .atag {{ font-weight:bold; color:#7a5b1e; font-size:13px; margin-bottom:4px; }}
  .ainner {{ border:1px dashed #c9b98a; border-radius:6px; padding:6px 10px; margin:4px 0; font-size:13px; }}
  .ainner.boxed {{ border-style:solid; border-color:#a08a4a; }}
  .aarrow, .aarrow2 {{ text-align:center; color:#7a5b1e; font-weight:bold; margin:2px 0; }}
  .dim {{ color:#8a7a50; font-size:12px; }}
</style></head><body>{body}</body></html>'''

open(OUT, 'w', encoding='utf-8').write(html)
print('HTML OK:', os.path.getsize(OUT)//1024, 'KB, mermaid 替换数:', mer_id)
