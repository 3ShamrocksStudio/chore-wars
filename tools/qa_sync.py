"""Chore Wars QA: 3 separate browser contexts (= 3 phones) at 390x844.
Proves realtime sync, parent-approved joins, stranger isolation, PIN lockout; captures every main screen.
Usage: python3 tools/qa_sync.py BASE_URL OUT_DIR
"""
import sys, os, time, json, base64, struct, zlib
from playwright.sync_api import sync_playwright

BASE, OUT = sys.argv[1].rstrip('/') + '/', sys.argv[2]
os.makedirs(OUT, exist_ok=True)
errors, shots = [], []
class Results(list):
    def append(self, r): super().append(r); print(r, flush=True)
results = Results()

def photo(path):
    """A realistic-looking proof photo (JPEG): a plate rack drawn with PIL."""
    from PIL import Image, ImageDraw, ImageFilter
    im = Image.new('RGB', (1600, 1200), (214, 196, 170)); d = ImageDraw.Draw(im)
    d.rectangle([0, 760, 1600, 1200], fill=(120, 92, 70))
    for i in range(6):
        x = 220 + i * 200
        d.ellipse([x, 380, x + 180, 760], fill=(245, 245, 240), outline=(170, 170, 170), width=8)
        d.ellipse([x + 45, 470, x + 135, 670], fill=(225, 230, 235))
    d.rectangle([180, 720, 1420, 780], fill=(90, 90, 100))
    im = im.filter(ImageFilter.GaussianBlur(2)); im.save(path, 'JPEG', quality=88)
PHOTO = os.path.join(OUT, '_proof.jpg'); photo(PHOTO)
PIN_JS = "(g)=>window.supabase.createClient(CW_CONFIG.url, CW_CONFIG.key).rpc('cw_parent',{p_code:document.getElementById('f_code').value,p_pin:g,p_device:'qa-pin-device-0001'}).then(r=>r.data&&r.data.err)"

def phone(browser, name):
    ctx = browser.new_context(viewport={'width': 390, 'height': 844}, device_scale_factor=2, is_mobile=True, has_touch=True)
    pg = ctx.new_page()
    pg.on('console', lambda m: m.type == 'error' and errors.append(f'{name}: {m.text}'))
    pg.on('pageerror', lambda e: errors.append(f'{name}: pageerror {e}'))
    pg.on('crash', lambda p: errors.append(f'{name}: CRASH'))
    return pg

def shot(pg, n):
    pg.wait_for_timeout(700)
    n = '%02d-%s' % (len(shots) + 1, n.split('-', 1)[1])
    p = os.path.join(OUT, n + '.png')
    for i in range(3):
        try: pg.screenshot(path=p); break
        except Exception: pg.wait_for_timeout(600)
    shots.append(p)

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
    A = phone(br, 'parent'); B = phone(br, 'zap'); C = phone(br, 'nova')

    # Parent: onboarding -> create family
    A.goto(BASE); A.wait_for_selector('.onb'); shot(A, '01-onboarding')
    tap(A, '#onbNext'); A.wait_for_timeout(500); tap(A, '#onbNext'); A.wait_for_timeout(500); tap(A, '#onbNext')
    A.wait_for_selector('[data-act=go_create]'); shot(A, '03-start')
    tap(A, '[data-act=go_create]')
    A.fill('#f_house', 'QA House'); A.fill('#f_name', 'Captain'); A.fill('#f_pin', '4321'); shot(A, '04-create')
    tap(A, '[data-act=create]'); A.wait_for_selector('.bigcode', timeout=15000)
    code = A.inner_text('.bigcode').strip(); shot(A, '05-parent-invite-qr')

    # Kids ask to join on their own phones; the parent approves each one
    def ask(pg, name, avatar=None, badge=None):
        pg.goto(BASE + '?join=' + code); pg.wait_for_selector('#f_name', timeout=15000); pg.fill('#f_name', name)
        if avatar: tap(pg, f'[data-act=pick_av][data-id={avatar}]')
        if badge: tap(pg, f'[data-act=pick_bd][data-id={badge}]')
        return pg
    ask(B, 'Zap', 'shark', 'rocket'); shot(B, '06-join-pick-badge'); tap(B, '[data-act=join_new]'); B.wait_for_selector('.waitroom', timeout=15000)
    t0 = time.time(); wait_sync('join request reaches parent phone', A, "!!document.querySelector('[data-act=req_ok]')", t0)
    shot(B, '07-kid-waiting'); shot(A, '08-parent-approve-join')
    no_leak = B.evaluate("!document.body.innerText.includes('QA House') && !document.body.innerText.includes('Captain') && !CW_DEBUG.state()")
    results.append(('pending kid sees no household data', 'PASS' if no_leak else 'FAIL', 0))
    t0 = time.time(); tap(A, '[data-act=req_ok]')
    wait_sync('parent approves -> kid phone enters game', B, "!!document.querySelector('nav.tabs')", t0)
    B.wait_for_timeout(600); shot(B, '09-kid-first-screen-chores')
    first_tab = B.evaluate("document.querySelector('nav.tabs button.on').dataset.id")
    results.append(('kid opens on Chores with Grab highlighted', 'PASS' if first_tab == 'chores' and B.evaluate("!!document.querySelector('.btn.grab.first')") else 'FAIL', 0))
    ask(C, 'Nova', 'cat', 'star'); tap(C, '[data-act=join_new]'); C.wait_for_selector('.waitroom', timeout=15000)
    A.wait_for_selector('[data-act=req_ok]', timeout=15000); tap(A, '[data-act=req_ok]'); C.wait_for_selector('nav.tabs', timeout=15000)
    t0 = time.time(); wait_sync('both kids visible on parent phone', A, "document.querySelectorAll('.mgr').length>=3", t0)

    # Stranger with only the code: waits, sees nothing, parent says No
    X = phone(br, 'stranger'); ask(X, 'Stranger'); tap(X, '[data-act=join_new]'); X.wait_for_selector('.waitroom', timeout=15000)
    X.wait_for_timeout(1500)
    txt = X.evaluate("document.body.innerText")
    leak = [n for n in ('QA House', 'Captain', 'Zap', 'Nova') if n in txt] or X.evaluate("!!CW_DEBUG.state()")
    results.append(('stranger with code sees nothing before approval', 'FAIL' if leak else 'PASS', 0))
    shot(X, '10-stranger-waiting')
    A.wait_for_selector('[data-act=req_no]', timeout=15000); t0 = time.time(); tap(A, '[data-act=req_no]')
    wait_sync('parent says No -> stranger is out', X, "!document.querySelector('.waitroom')", t0)
    results.append(('stranger never got a session', 'PASS' if X.evaluate("!localStorage.getItem('cw_session')") else 'FAIL', 0))
    X.context.close()   # keep at most 4 phones open: more renderers at 2x crash the 2-CPU QA box

    sid = lambda pg, i: pg.evaluate(f"CW_DEBUG.state().chores[{i}].id")
    for pg in (B, C): tap(pg, '[data-act=tab][data-id=chores]')
    ch_dishes = B.evaluate("CW_DEBUG.state().chores.find(c=>c.icon==='dishes').id")
    ch_trash = B.evaluate("CW_DEBUG.state().chores.find(c=>c.icon==='trash').id")
    ch_bed = B.evaluate("CW_DEBUG.state().chores.find(c=>c.icon==='bed').id")

    # 1. claim syncs
    t0 = time.time(); tap(B, f'[data-act=claim][data-id="{ch_dishes}"]')
    wait_sync('Zap grabs Dishes -> Nova sees it', C, f"!!document.querySelector('[data-chore=\"{ch_dishes}\"] [data-act=steal]')", t0)
    shot(B, '07-player-chores')
    # 2. steal syncs
    t0 = time.time(); tap(C, f'[data-act=steal][data-id="{ch_dishes}"]')
    wait_sync('Nova steals Dishes -> Zap loses it', B, f"CW_DEBUG.state().chores.find(c=>c.id==='{ch_dishes}').owner!==CW_DEBUG.state().me", t0)
    B.wait_for_timeout(300); shot(B, '08-stolen-alert')
    # 3. swap offer / accept
    tap(B, f'[data-act=claim][data-id="{ch_trash}"]'); B.wait_for_timeout(1200)
    tap(B, f'[data-act=swap_sheet][data-id="{ch_dishes}"]'); B.wait_for_selector('#sheet'); shot(B, '09-swap-offer'); tap(B, '[data-sheet=send]')
    t0 = time.time(); wait_sync('Zap offers swap -> Nova sees offer', C, "CW_DEBUG.state().trades.some(t=>t.status==='open'&&t.to===CW_DEBUG.state().me)", t0)
    tap(C, '[data-act=tab][data-id=trades]'); shot(C, '10-swap-incoming')
    t0 = time.time(); tap(C, '[data-act=accept]')
    wait_sync('Nova accepts swap -> Zap owns Dishes', B, f"CW_DEBUG.state().chores.find(c=>c.id==='{ch_dishes}').owner===CW_DEBUG.state().me", t0)
    # 4. head-to-head challenge
    tap(B, '[data-act=tab][data-id=arena]'); tap(B, '[data-act=challenge_pick]'); B.wait_for_selector('#sheet [data-r]'); tap(B, '#sheet [data-r]')
    t0 = time.time(); tap(C, '[data-act=tab][data-id=arena]')
    wait_sync('Zap challenges -> Nova sees Fight', C, "!!document.querySelector('[data-act=chal_yes]')", t0)
    tap(C, '[data-act=chal_yes]'); C.wait_for_timeout(800)
    # 5. done with photo -> parent verify
    tap(B, '[data-act=tab][data-id=chores]'); tap(B, f'[data-act=done_sheet][data-id="{ch_dishes}"]'); B.wait_for_selector('#proofIn', state='attached')
    shot(B, '11-proof-sheet')
    t0 = time.time(); B.set_input_files('#proofIn', PHOTO)
    tap(A, '[data-act=tab][data-id=verify]')
    wait_sync('Zap sends photo proof -> parent sees it', A, "!!document.querySelector('.ver img.ph')", t0)
    A.wait_for_timeout(400); shot(A, '12-parent-verify-photo')
    sz = A.evaluate("CW_DEBUG.state().chores.find(c=>c.status==='done').proof.length")
    dims = A.evaluate("(()=>{const i=document.querySelector('.ver img.ph');return [i.naturalWidth,i.naturalHeight]})()")
    results.append((f'proof photo <=720px JPEG ({dims[0]}x{dims[1]}, {sz} chars)', 'PASS' if max(dims) <= 720 and sz < 400000 else 'FAIL', 0))
    t0 = time.time(); tap(A, '[data-act=approve]')
    wait_sync('Parent approves -> Zap gets points', B, "CW_DEBUG.state().players.find(p=>p.id===CW_DEBUG.state().me).pts>0", t0)
    B.wait_for_timeout(200); shot(B, '13-points-burst')
    # 6. bounty
    tap(A, '[data-act=tab][data-id=chores]'); t0 = time.time(); tap(A, f'[data-act=bounty][data-id="{ch_bed}"]')
    wait_sync('Parent bounty -> Nova sees bounty', C, f"CW_DEBUG.state().chores.find(c=>c.id==='{ch_bed}').bounty===10", t0)
    shot(A, '14-parent-chores')
    tap(B, '[data-act=tab][data-id=arena]'); B.wait_for_timeout(1600); shot(B, '15-arena-leaderboard')
    tap(C, '[data-act=tab][data-id=chores]'); shot(C, '16-chores-bounty')
    tap(B, '[data-act=tab][data-id=cards]'); shot(B, '17-cards-shop')
    tap(B, '[data-act=ad]'); B.wait_for_selector('#adn'); B.wait_for_timeout(1500); shot(B, '18-ad-countdown')
    B.wait_for_timeout(4300); shot(B, '19-ad-card-reveal'); B.wait_for_timeout(2500)
    tap(B, '[data-act=profile]'); B.wait_for_selector('#sheet'); shot(B, '20-profile-rank')
    tap(A, '[data-act=tab][data-id=arena]'); shot(A, '21-parent-arena')
    B.evaluate("document.getElementById('sheet')&&document.getElementById('sheet').remove()")
    B.evaluate("CW_DEBUG.crown()"); B.wait_for_timeout(2300); shot(B, '22-crown-ceremony'); tap(B, '[data-crown]'); B.wait_for_timeout(400)

    # Freed kid seat: only a parent-approved request can take it back
    tap(A, '[data-act=tab][data-id=invite]'); A.wait_for_timeout(500)
    nova_id = A.evaluate("CW_DEBUG.state().players.find(p=>p.name==='Nova').id")
    tap(A, f'[data-act=free_seat][data-id="{nova_id}"]'); A.wait_for_timeout(1200)
    C.context.close()   # Nova's old phone was signed out by "New phone"
    N = phone(br, 'nova-new-phone'); ask(N, 'Nova'); tap(N, '[data-act=join_new]'); N.wait_for_selector('.waitroom', timeout=15000)
    A.wait_for_selector('[data-act=req_seat]', timeout=15000); shot(A, '23-parent-seat-claim')
    t0 = time.time(); tap(A, f'[data-act=req_seat][data-seat="{nova_id}"]')
    wait_sync('freed seat taken back only after parent approval', N, f"!!document.querySelector('nav.tabs') && CW_DEBUG.state().me==='{nova_id}'", t0)
    N.context.close()

    # 6 wrong parent PINs -> locked out: the 5th wrong try locks for 15 min, even the right PIN
    P2 = phone(br, 'pin-guesser'); P2.goto(BASE + '?join=' + code); P2.wait_for_selector('[data-act=parent_mode]', timeout=15000)
    tap(P2, '[data-act=parent_mode]'); P2.wait_for_selector('#f_pin')
    pin_res = [P2.evaluate(PIN_JS, g) for g in ['0000', '1111', '2222', '3333', '5555', '6666']]
    right = P2.evaluate(PIN_JS, '4321')
    ok_lock = pin_res[:4] == ['bad_pin'] * 4 and pin_res[4:] == ['locked', 'locked'] and right == 'locked'
    results.append((f'6 wrong PINs -> lockout {pin_res}, then right PIN={right}', 'PASS' if ok_lock else 'FAIL', 0))
    P2.fill('#f_pin', '9999'); tap(P2, '[data-act=parent_in]'); P2.wait_for_timeout(1200); shot(P2, '24-pin-locked')

    A.wait_for_timeout(300)
    br.close()

ok = all(r[1] == 'PASS' for r in results)
report = {'base': BASE, 'code': code, 'sync': results, 'console_errors': errors, 'screens': shots, 'pass': ok and not errors}
json.dump(report, open(os.path.join(OUT, 'qa-report.json'), 'w'), indent=1)
for r in results: print(r)
print('console errors:', len(errors)); [print(' ', e[:200]) for e in errors]
print('PASS' if report['pass'] else 'FAIL')
