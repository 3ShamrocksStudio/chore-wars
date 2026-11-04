"""Chore Wars QA: 3 separate browser contexts (= 3 phones) at 390x844.
Proves realtime sync between devices and captures every main screen.
Usage: python3 tools/qa_sync.py BASE_URL OUT_DIR
"""
import sys, os, time, json, base64, struct, zlib
from playwright.sync_api import sync_playwright

BASE, OUT = sys.argv[1].rstrip('/') + '/', sys.argv[2]
os.makedirs(OUT, exist_ok=True)
errors, results, shots = [], [], []

def png(path):
    w, h = 64, 48
    raw = b''.join(b'\x00' + bytes([40, 200, 230]) * w for _ in range(h))
    def chunk(t, d): return struct.pack('>I', len(d)) + t + d + struct.pack('>I', zlib.crc32(t + d) & 0xffffffff)
    open(path, 'wb').write(b'\x89PNG\r\n\x1a\n' + chunk(b'IHDR', struct.pack('>IIBBBBB', w, h, 8, 2, 0, 0, 0)) + chunk(b'IDAT', zlib.compress(raw)) + chunk(b'IEND', b''))
PHOTO = os.path.join(OUT, '_proof.png'); png(PHOTO)

def phone(browser, name):
    ctx = browser.new_context(viewport={'width': 390, 'height': 844}, device_scale_factor=2, is_mobile=True, has_touch=True)
    pg = ctx.new_page()
    pg.on('console', lambda m: m.type == 'error' and errors.append(f'{name}: {m.text}'))
    pg.on('pageerror', lambda e: errors.append(f'{name}: pageerror {e}'))
    return pg

def shot(pg, n):
    pg.wait_for_timeout(700)
    p = os.path.join(OUT, n + '.png'); pg.screenshot(path=p); shots.append(p)

def tap(pg, sel):
    pg.locator(sel).first.click()

def wait_sync(label, pg, js, t0, timeout=12):
    end = time.time() + timeout
    while time.time() < end:
        if pg.evaluate(js): results.append((label, 'PASS', round(time.time() - t0, 2))); return True
        pg.wait_for_timeout(100)
    results.append((label, 'FAIL', timeout)); return False

with sync_playwright() as p:
    br = p.chromium.launch()
    A = phone(br, 'parent'); B = phone(br, 'jakob'); C = phone(br, 'dean')

    # Parent: onboarding -> create family
    A.goto(BASE); A.wait_for_selector('.onb'); shot(A, '01-onboarding')
    tap(A, '#onbNext'); A.wait_for_timeout(500); tap(A, '#onbNext'); A.wait_for_timeout(500); shot(A, '02-onboarding-3'); tap(A, '#onbNext')
    A.wait_for_selector('[data-act=go_create]'); shot(A, '03-start')
    tap(A, '[data-act=go_create]')
    A.fill('#f_house', 'QA Clan'); A.fill('#f_name', 'Daddy'); A.fill('#f_pin', '4321'); shot(A, '04-create')
    tap(A, '[data-act=create]'); A.wait_for_selector('.bigcode', timeout=15000)
    code = A.inner_text('.bigcode').strip(); shot(A, '05-parent-invite-qr')

    # Two kids join on their own phones through the invite link
    B.goto(BASE + '?join=' + code); B.wait_for_selector('#f_name', timeout=15000); B.fill('#f_name', 'Jakob')
    tap(B, '[data-act=pick_av][data-id=wolf]'); shot(B, '06-join'); tap(B, '[data-act=join_new]'); B.wait_for_selector('nav.tabs', timeout=15000)
    C.goto(BASE + '?join=' + code); C.wait_for_selector('#f_name', timeout=15000); C.fill('#f_name', 'Dean'); tap(C, '[data-act=join_new]'); C.wait_for_selector('nav.tabs', timeout=15000)
    t0 = time.time(); wait_sync('join visible on parent phone', A, "document.querySelectorAll('.mgr').length>=3", t0)

    sid = lambda pg, i: pg.evaluate(f"CW_DEBUG.state().chores[{i}].id")
    for pg in (B, C): tap(pg, '[data-act=tab][data-id=chores]')
    ch_dishes = B.evaluate("CW_DEBUG.state().chores.find(c=>c.icon==='dishes').id")
    ch_trash = B.evaluate("CW_DEBUG.state().chores.find(c=>c.icon==='trash').id")
    ch_bed = B.evaluate("CW_DEBUG.state().chores.find(c=>c.icon==='bed').id")

    # 1. claim syncs
    t0 = time.time(); tap(B, f'[data-act=claim][data-id="{ch_dishes}"]')
    wait_sync('Jakob grabs Dishes -> Dean sees it', C, f"!!document.querySelector('[data-chore=\"{ch_dishes}\"] [data-act=steal]')", t0)
    shot(B, '07-player-chores')
    # 2. steal syncs
    t0 = time.time(); tap(C, f'[data-act=steal][data-id="{ch_dishes}"]')
    wait_sync('Dean steals Dishes -> Jakob loses it', B, f"CW_DEBUG.state().chores.find(c=>c.id==='{ch_dishes}').owner!==CW_DEBUG.state().me", t0)
    B.wait_for_timeout(300); shot(B, '08-stolen-alert')
    # 3. swap offer / accept
    tap(B, f'[data-act=claim][data-id="{ch_trash}"]'); B.wait_for_timeout(1200)
    tap(B, f'[data-act=swap_sheet][data-id="{ch_dishes}"]'); B.wait_for_selector('#sheet'); shot(B, '09-swap-offer'); tap(B, '[data-sheet=send]')
    t0 = time.time(); wait_sync('Jakob offers swap -> Dean sees offer', C, "CW_DEBUG.state().trades.some(t=>t.status==='open'&&t.to===CW_DEBUG.state().me)", t0)
    tap(C, '[data-act=tab][data-id=trades]'); shot(C, '10-swap-incoming')
    t0 = time.time(); tap(C, '[data-act=accept]')
    wait_sync('Dean accepts swap -> Jakob owns Dishes', B, f"CW_DEBUG.state().chores.find(c=>c.id==='{ch_dishes}').owner===CW_DEBUG.state().me", t0)
    # 4. head-to-head challenge
    tap(B, '[data-act=tab][data-id=arena]'); tap(B, '[data-act=challenge_pick]'); B.wait_for_selector('#sheet [data-r]'); tap(B, '#sheet [data-r]')
    t0 = time.time(); tap(C, '[data-act=tab][data-id=arena]')
    wait_sync('Jakob challenges -> Dean sees Fight', C, "!!document.querySelector('[data-act=chal_yes]')", t0)
    tap(C, '[data-act=chal_yes]'); C.wait_for_timeout(800)
    # 5. done with photo -> parent verify
    tap(B, '[data-act=tab][data-id=chores]'); tap(B, f'[data-act=done_sheet][data-id="{ch_dishes}"]'); B.wait_for_selector('#proofIn', state='attached')
    shot(B, '11-proof-sheet')
    t0 = time.time(); B.set_input_files('#proofIn', PHOTO)
    tap(A, '[data-act=tab][data-id=verify]')
    wait_sync('Jakob sends photo proof -> parent sees it', A, "!!document.querySelector('.ver img.ph')", t0)
    shot(A, '12-parent-verify')
    t0 = time.time(); tap(A, '[data-act=approve]')
    wait_sync('Parent approves -> Jakob gets points', B, "CW_DEBUG.state().players.find(p=>p.id===CW_DEBUG.state().me).pts>0", t0)
    B.wait_for_timeout(200); shot(B, '13-points-burst')
    # 6. bounty
    tap(A, '[data-act=tab][data-id=chores]'); t0 = time.time(); tap(A, f'[data-act=bounty][data-id="{ch_bed}"]')
    wait_sync('Parent bounty -> Dean sees bounty', C, f"CW_DEBUG.state().chores.find(c=>c.id==='{ch_bed}').bounty===10", t0)
    shot(A, '14-parent-chores')
    tap(B, '[data-act=tab][data-id=arena]'); B.wait_for_timeout(1600); shot(B, '15-arena-leaderboard')
    tap(C, '[data-act=tab][data-id=chores]'); shot(C, '16-chores-bounty')
    tap(B, '[data-act=tab][data-id=cards]'); shot(B, '17-cards-shop')
    tap(B, '[data-act=ad]'); B.wait_for_selector('#adn'); shot(B, '18-ad-slot')
    B.wait_for_timeout(5600); shot(B, '19-card-won')
    tap(B, '[data-act=profile]'); B.wait_for_selector('#sheet'); shot(B, '20-profile-rank')
    tap(A, '[data-act=tab][data-id=arena]'); shot(A, '21-parent-arena')

    for pg in (A, B, C): pg.wait_for_timeout(300)
    br.close()

ok = all(r[1] == 'PASS' for r in results)
report = {'base': BASE, 'code': code, 'sync': results, 'console_errors': errors, 'screens': shots, 'pass': ok and not errors}
json.dump(report, open(os.path.join(OUT, 'qa-report.json'), 'w'), indent=1)
for r in results: print(r)
print('console errors:', len(errors)); [print(' ', e[:200]) for e in errors]
print('PASS' if report['pass'] else 'FAIL')
