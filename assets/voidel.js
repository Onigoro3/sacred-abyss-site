/* ==================================================================
   ヴォイデル文字(Voidel)の描画と書き換え v0.1(2026-10-01)
   正本は script.json。ブラウザでもNode(一覧表の書き出し)でも同じ処理を使う。
     Voidel.load(scriptJson)
     Voidel.fromKana('おにごろ')      → 字の並び(子音+母音の印 など)
     Voidel.fromLatin('Sacred Abyss') → 英語のつづりどおり(母音は母音の字、子音だけは母音なしの印)
     Voidel.fromRoman('vael-en esta') → ヴォイデル語(ローマ字で書いた語。子音+母音は1字にまとめる)
     Voidel.draw(ctx, unit, x, y, size)  → 1字を描く
   ================================================================== */
(function (root) {
    var S = null, LG = null;
    var V = {};
    V.load = function (json) { S = json; return V; };
    // 2026-10-01 意味の字(漢字に対応する1字)。正本 logograms.json(make_logograms.py が書き出す)
    V.loadLogograms = function (json) { LG = json; if (typeof window !== 'undefined') window.__LG = json; return V; };
    V.hasLogogram = function (ch) { return !!(LG && LG.chars[ch]); };

    /* ---------- 書き換え ---------- */
    var KANA = {};
    (function () {
        var rows = {
            '': 'あいうえお', k: 'かきくけこ', s: 'さしすせそ', t: 'たちつてと', n: 'なにぬねの', h: 'はひふへほ',
            m: 'まみむめも', y: 'や_ゆ_よ', r: 'らりるれろ', w: 'わ___を', g: 'がぎぐげご', z: 'ざじずぜぞ',
            d: 'だぢづでど', b: 'ばびぶべぼ', p: 'ぱぴぷぺぽ'
        };
        var vs = 'aiueo';
        Object.keys(rows).forEach(function (c) {
            var str = rows[c];
            for (var i = 0; i < 5; i++) {
                var ch = str[i]; if (ch === '_') continue;
                KANA[ch] = { c: c || null, v: vs[i] };
            }
        });
        KANA['ゔ'] = { c: 'v', v: 'u' };   // ヴ(ヴォ=v+o は小さいォで直す)
        // 日本語の音に寄せた子音(し=s+i, ち=t+i, つ=t+u, ふ=h+u, じ=z+i, を=w+o)はそのまま。ヴォイデル文字は音の箱で書く
    })();
    var SMALL_Y = { 'ゃ': 'a', 'ゅ': 'u', 'ょ': 'o' };
    var SMALL_V = { 'ぁ': 'a', 'ぃ': 'i', 'ぅ': 'u', 'ぇ': 'e', 'ぉ': 'o' };
    function toHira(str) {
        return str.replace(/[ァ-ヶ]/g, function (ch) { return String.fromCharCode(ch.charCodeAt(0) - 0x60); });
    }
    function punct(ch) {
        if (ch === '。' || ch === '.') return { sp: 'period' };
        if (ch === '、' || ch === ',') return { sp: 'comma' };
        if (ch === '？' || ch === '?') return { sp: 'question' };
        if (ch === '！' || ch === '!') return { sp: 'exclaim' };
        if (ch === ' ' || ch === '　') return { sp: 'space' };
        if (/[0-9０-９]/.test(ch)) return { dg: String('０１２３４５６７８９'.indexOf(ch) >= 0 ? '０１２３４５６７８９'.indexOf(ch) : ch) };
        return null;
    }
    V.fromKana = function (str) {
        var out = [], s = toHira(str);
        for (var i = 0; i < s.length; i++) {
            var ch = s[i], nx = s[i + 1];
            if (ch === 'ん') { out.push({ c: 'n', v: null }); continue; }
            if (ch === 'っ') { out.push({ sp: 'geminate' }); continue; }
            if (ch === 'ー') { out.push({ sp: 'long' }); continue; }
            var k = KANA[ch];
            if (k) {
                var u = { c: k.c, v: k.v };
                if (nx && SMALL_Y[nx]) { u.pal = true; u.v = SMALL_Y[nx]; i++; }
                else if (nx && SMALL_V[nx]) { u.v = SMALL_V[nx]; i++; }
                out.push(u.c ? u : { iv: u.v, pal: u.pal });
                continue;
            }
            var p = punct(ch); if (p) out.push(p);
        }
        return out;
    };
    var VOW = 'aeiou';
    V.fromLatin = function (str) {
        // 英語などのつづりどおり。母音は母音の字、子音は母音なしの印つき(1文字=1字)
        var out = [], s = str.toLowerCase();
        for (var i = 0; i < s.length; i++) {
            var ch = s[i];
            if (VOW.indexOf(ch) >= 0) { out.push({ iv: ch }); continue; }
            if (S.consonants[ch]) { out.push({ c: ch, v: null }); continue; }
            var p = punct(ch); if (p) out.push(p);
        }
        return out;
    };
    V.fromRoman = function (str) {
        // ヴォイデル語・ローマ字打ち。フォント(build_font.py)と同じ決まり:
        //   子音+母音→1字 / 子音+y+母音→ゃゅょの印 / sh・ch+母音→s・t+ゃゅょ(shi=s+i, chi=t+i) / tsu=t+u
        //   同じ子音が続く(n以外)→「っ」/ nn→ん / - →のばす音 / 子音だけ→母音なしの印
        var out = [], s = str.toLowerCase();
        var isV = function (ch) { return ch && VOW.indexOf(ch) >= 0; };
        for (var i = 0; i < s.length; i++) {
            var ch = s[i], n1 = s[i + 1], n2 = s[i + 2];
            if (ch === '-') { out.push({ sp: 'long' }); continue; }
            if (S.consonants[ch]) {
                if (ch === 'n' && n1 === 'n') { out.push({ c: 'n', v: null }); i++; continue; }
                if (ch !== 'n' && n1 === ch) { out.push({ sp: 'geminate' }); continue; }
                if ((ch === 's' || ch === 'c') && n1 === 'h' && isV(n2)) {
                    var base = ch === 's' ? 's' : 't';
                    out.push(n2 === 'i' ? { c: base, v: 'i' } : { c: base, v: n2, pal: true }); i += 2; continue;
                }
                if (ch === 't' && n1 === 's' && n2 === 'u') { out.push({ c: 't', v: 'u' }); i += 2; continue; }
                if (n1 === 'y' && isV(n2)) { out.push({ c: ch, v: n2, pal: true }); i += 2; continue; }
                if (isV(n1)) { out.push({ c: ch, v: n1 }); i++; continue; }
                out.push({ c: ch, v: null }); continue;
            }
            if (isV(ch)) { out.push({ iv: ch }); continue; }
            var p = punct(ch); if (p) out.push(p);
        }
        return out;
    };
    // 日本語の文(漢字かな混じり)→ 字の並び。意味の字がある漢字は1字、かなは音の字、意味の字の無い漢字は飛ばす
    V.fromText = function (str) {
        var out = [], run = '';
        var flush = function () { if (run) { out = out.concat(V.fromKana(run)); run = ''; } };
        for (var i = 0; i < str.length; i++) {
            var ch = str[i];
            if (LG && LG.chars[ch]) { flush(); out.push({ lg: ch }); continue; }
            if (/[一-鿿]/.test(ch)) { flush(); continue; }
            run += ch;
        }
        flush();
        return out;
    };
    V.label = function (u) {
        if (u.lg) return u.lg;
        if (u.sp) return { period: '。', comma: '、', question: '?', exclaim: '!', geminate: 'っ', long: 'ー', space: ' ' }[u.sp];
        if (u.dg !== undefined) return u.dg;
        if (u.iv) return u.iv;
        return u.c + (u.pal ? 'y' : '') + (u.v === null ? '' : u.v);
    };

    /* ---------- 描画 ---------- */
    // w・h を渡すと、字の箱の一部(部品の置き場)に縦横を合わせて描く。線の太さは字の大きさ s のまま
    function strokes(ctx, list, x, y, s, w, h, lw) {
        w = w || s; h = h || s;
        var node = function (c, r) { return [x + (c / 2) * w, y + (r / 3) * h]; };
        var m = Math.min(w, h);
        ctx.lineWidth = Math.max(0.8, s * (lw || 0.07)); ctx.lineCap = 'round'; ctx.lineJoin = 'round';
        list.forEach(function (st) {
            var t = st[0];
            if (t === 'L') { var a = node(st[1], st[2]), b = node(st[3], st[4]); ctx.beginPath(); ctx.moveTo(a[0], a[1]); ctx.lineTo(b[0], b[1]); ctx.stroke(); }
            else if (t === 'Q') { var a2 = node(st[1], st[2]), b2 = node(st[3], st[4]), c2 = node(st[5], st[6]); ctx.beginPath(); ctx.moveTo(a2[0], a2[1]); ctx.quadraticCurveTo(c2[0], c2[1], b2[0], b2[1]); ctx.stroke(); }
            else if (t === 'R') { var r0 = node(st[1], st[2]); ctx.beginPath(); ctx.arc(r0[0], r0[1], m * 0.16, 0, Math.PI * 2); ctx.stroke(); }
            else if (t === 'D') { var d0 = node(st[1], st[2]); ctx.beginPath(); ctx.arc(d0[0], d0[1], Math.max(1, Math.min(s * 0.06, m * 0.09)), 0, Math.PI * 2); ctx.fillStyle = ctx.strokeStyle; ctx.fill(); }
        });
    }
    function mark(ctx, list, x, y, s) {
        ctx.lineWidth = Math.max(0.8, s * 0.06);
        list.forEach(function (m) {
            var px = x + m[1] * s, py = y + m[2] * s;
            ctx.beginPath();
            if (m[0] === 'dot') { ctx.arc(px, py, Math.max(1, s * 0.07), 0, Math.PI * 2); ctx.fillStyle = ctx.strokeStyle; ctx.fill(); return; }
            if (m[0] === 'ring') ctx.arc(px, py, s * 0.1, 0, Math.PI * 2);
            if (m[0] === 'bar') { ctx.moveTo(px - s * 0.22, py); ctx.lineTo(px + s * 0.22, py); }
            if (m[0] === 'slash') { ctx.moveTo(px - s * 0.14, py + s * 0.08); ctx.lineTo(px + s * 0.14, py - s * 0.08); }
            if (m[0] === 'tick') { ctx.moveTo(px, py); ctx.lineTo(px + s * 0.12, py - s * 0.18); }
            ctx.stroke();
        });
    }
    function part(id) {
        if (id[0] === 'd' && /^d\d$/.test(id)) return S.digits[id.slice(1)];
        return LG.radicals[id].s;
    }
    V.drawLogogram = function (ctx, ch, x, y, s) {
        var c = LG.chars[ch]; if (!c) return;
        var boxes = LG.layouts[c.l], one = c.l === 'one';
        c.p.forEach(function (id, i) {
            var b = boxes[i];
            strokes(ctx, part(id), x + b[0] * s, y + b[1] * s, s, (b[2] - b[0]) * s, (b[3] - b[1]) * s, one ? 0.07 : 0.06);
        });
    };
    V.draw = function (ctx, u, x, y, s) {
        if (u.lg) { V.drawLogogram(ctx, u.lg, x, y, s); return; }
        if (u.sp) { strokes(ctx, S.specials[u.sp] || [], x, y, s); return; }
        if (u.dg !== undefined) { strokes(ctx, S.digits[u.dg] || [], x, y, s); return; }
        if (u.iv) { strokes(ctx, S.vowels_independent[u.iv], x, y, s); if (u.pal) mark(ctx, S.marks.palatal, x, y, s); return; }
        strokes(ctx, S.consonants[u.c], x, y, s);
        if (u.pal) mark(ctx, S.marks.palatal, x, y, s);
        if (u.v === null) mark(ctx, S.marks.virama, x, y, s);
        else if (u.v !== 'a') mark(ctx, S.marks[u.v], x, y, s);
    };
    // 字の並びを1行に描く。字の幅=s、字間=gap。戻り値は描いた幅
    V.drawLine = function (ctx, units, x, y, s, gap) {
        gap = gap === undefined ? s * 0.55 : gap;
        var cx = x;
        units.forEach(function (u) { if (u.sp === 'space') { cx += s * 0.9; return; } V.draw(ctx, u, cx, y, s); cx += s + gap; });
        return cx - x - gap;
    };

    root.Voidel = V;
})(typeof window !== 'undefined' ? window : globalThis);

Voidel.load({"version":"0.1","grid":{"cols":3,"rows":4},"consonants":{"b":[["L",0,0,0,3],["Q",0,1,2,2,2,0],["D",2,3]],"c":[["Q",2,0,2,3,0,1.5],["D",1.2,1.5]],"d":[["L",1,0,1,3],["R",0,1],["L",1,2,2,3]],"f":[["L",0,0,2,0],["L",1,0,0,3],["R",2,2]],"g":[["Q",0,0,2,1,2,-0.4],["L",2,1,0,3],["D",0,1]],"h":[["L",0,0,0,3],["Q",0,3,2,0,2,3],["D",1,0]],"j":[["L",1,0,1,2],["Q",1,2,0,3,2,3],["R",2,0.6]],"k":[["L",0,0,2,3],["L",0,3,1,1.5],["R",2,0]],"l":[["L",1,0,1,3],["L",1,3,2,2],["L",0,1,1,0]],"m":[["Q",0,3,2,3,1,-1],["L",1,1,1,3]],"n":[["Q",0,0,2,0,1,2],["L",1,1,1,3],["D",0,3]],"p":[["R",1,1],["L",1,0,1,3],["L",1,3,2,3]],"q":[["R",1,2],["L",0,0,2,0],["L",1,0,1,1.5]],"r":[["L",2,0,2,3],["L",2,1,0,0],["R",0,2]],"s":[["Q",0,0,2,3,2,0],["D",0,3],["D",2,0]],"t":[["L",0,0,2,0],["Q",1,0,1,3,2,1.5],["D",0,2]],"v":[["L",0,0,1,3],["L",1,3,2,1],["R",2,0]],"w":[["Q",0,0,1,0,0.5,2],["Q",1,0,2,0,1.5,2],["L",1,0,1,3]],"x":[["L",0,0,2,2],["L",2,0,0,2],["L",1,1,1,3]],"y":[["L",1,0,1,3],["L",0,0,1,1],["R",2,1]],"z":[["L",0,0,2,0],["L",2,0,0,2],["Q",0,2,2,3,0,3]]},"vowels_independent":{"a":[["R",1,1],["L",1,2,1,3]],"i":[["L",1,0,1,3],["D",0,1],["D",2,1]],"u":[["Q",0,0,2,0,1,3],["D",1,1]],"e":[["L",0,1,2,1],["L",0,2,2,2],["R",1,3]],"o":[["R",1,1],["R",1,2]]},"marks":{"i":[["dot",0.5,-0.22]],"u":[["ring",0.5,1.22]],"e":[["bar",0.5,-0.22]],"o":[["ring",0.5,-0.24]],"virama":[["slash",0.5,1.2]],"palatal":[["tick",-0.18,0.1]]},"specials":{"geminate":[["D",0,2],["D",2,2]],"long":[["L",0,2,2,2]],"period":[["R",1,3]],"comma":[["D",1,3]],"question":[["Q",0,0,2,1,2,0],["L",2,1,1,2],["D",1,3]],"exclaim":[["L",1,0,1,2],["D",1,3]],"space":[]},"digits":{"0":[["R",1,1],["R",1,2],["L",1,0,1,3]],"1":[["L",1,0,1,3]],"2":[["L",0,0,0,3],["L",2,0,2,3]],"3":[["L",0,0,0,3],["L",1,0,1,3],["L",2,0,2,3]],"4":[["L",0,0,2,0],["L",0,3,2,3],["L",0,0,0,3],["L",2,0,2,3]],"5":[["L",0,0,2,3],["L",2,0,0,3],["R",1,1]],"6":[["L",1,0,1,3],["L",0,1,2,1],["L",0,2,2,2]],"7":[["L",0,0,2,0],["L",2,0,1,3],["D",0,3]],"8":[["L",0,0,2,3],["L",2,0,0,3],["L",0,0,2,0],["L",0,3,2,3]],"9":[["R",1,1],["L",2,1,2,3],["D",0,3]]}});
Voidel.loadLogograms({"version":"0.1","layouts":{"one":[[0,0,1,1]],"lr":[[0,0,0.42,1],[0.56,0,1,1]],"tb":[[0,0,1,0.4],[0,0.54,1,1]],"lmr":[[0,0,0.26,1],[0.37,0,0.63,1],[0.74,0,1,1]],"in":[[0,0,1,1],[0.24,0.3,0.76,0.88]]},"radicals":{"hito":{"m":"人","s":[["R",1,0.55],["L",1,1.1,1,1.7],["Q",1,1.7,0.1,3,0.3,2.2],["Q",1,1.7,1.9,3,1.7,2.2]]},"kokoro":{"m":"心","s":[["R",1,1.7],["Q",0,0.6,2,0.6,1,-0.4],["D",1,3]]},"mizu":{"m":"水","s":[["Q",0,0.4,2,0.4,1,1.3],["Q",0,1.6,2,1.6,1,2.5],["Q",0,2.8,2,2.8,1,3.7]]},"hi":{"m":"火","s":[["Q",1,3,1,0,-0.3,1.6],["Q",1,3,1,0,2.3,1.6],["D",1,2.1]]},"ki":{"m":"木","s":[["L",1,0.3,1,3],["Q",1,1.2,0,0.2,0.2,1.2],["Q",1,1.2,2,0.2,1.8,1.2],["Q",0.2,3,1.8,3,1,2.5]]},"tsuchi":{"m":"土","s":[["L",0,3,2,3],["Q",0.1,2.4,1.9,2.4,1,0.6],["D",1,2.5]]},"kane":{"m":"金","s":[["L",0,1.2,1,0],["L",1,0,2,1.2],["L",2,1.2,1,3],["L",1,3,0,1.2],["D",1,1.4]]},"nichi":{"m":"日","s":[["R",1,1.5],["D",1,1.5],["L",1,0,1,0.6],["L",1,2.4,1,3],["L",0,1.5,0.4,1.5],["L",1.6,1.5,2,1.5]]},"tsuki":{"m":"月","s":[["Q",1.4,0,1.4,3,-0.6,1.5],["Q",1.4,0,1.4,3,0.5,1.5]]},"yama":{"m":"山","s":[["Q",0,3,1.2,3,0.6,-0.6],["Q",0.8,3,2,3,1.4,0.4]]},"ishi":{"m":"石","s":[["L",0.2,1,1.8,0.6],["L",1.8,0.6,2,2.6],["L",2,2.6,0,3],["L",0,3,0.2,1],["D",1,1.9]]},"kuchi":{"m":"口","s":[["Q",0,1.5,2,1.5,1,0.4],["Q",0,1.5,2,1.5,1,2.6],["L",0.5,1.5,1.5,1.5]]},"me":{"m":"目","s":[["Q",0,1.5,2,1.5,1,0.4],["Q",0,1.5,2,1.5,1,2.6],["D",1,1.5]]},"mimi":{"m":"耳","s":[["Q",0.7,0.2,0.7,2.8,2.6,1.2],["Q",0.9,1,0.9,2,1.6,1.5],["D",0.3,1.5]]},"te":{"m":"手","s":[["Q",0,2.2,2,2.2,1,3.4],["L",0.3,2.2,0.1,0.5],["L",1,2.2,1,0.2],["L",1.7,2.2,1.9,0.5]]},"ashi":{"m":"足","s":[["R",1,2.1],["D",0.4,0.5],["D",1,0.2],["D",1.6,0.5]]},"kotoba":{"m":"言","s":[["L",0,2.2,2,2.2],["D",0.4,1.3],["D",1,1.3],["D",1.6,1.3],["Q",0.4,2.2,1.6,2.2,1,3.2]]},"hikari":{"m":"光","s":[["D",1,1.5],["L",1,0,1,0.9],["L",1,2.1,1,3],["L",0,1.5,0.6,1.5],["L",1.4,1.5,2,1.5]]},"kyo":{"m":"虚(虚無・ヴォイド)","s":[["R",1,1.5],["D",0,0],["D",2,3]]},"dai":{"m":"大","s":[["Q",0.3,0,0.3,3,-0.5,1.5],["Q",1.7,0,1.7,3,2.5,1.5],["D",1,1.5]]},"sho":{"m":"小","s":[["Q",0.3,0.8,0.3,2.2,0.8,1.5],["Q",1.7,0.8,1.7,2.2,1.2,1.5],["D",1,1.5]]},"ue":{"m":"上","s":[["L",1,0,0,1.2],["L",1,0,2,1.2],["L",1,0,1,3]]},"shita":{"m":"下","s":[["L",1,3,0,1.8],["L",1,3,2,1.8],["L",1,0,1,3]]},"naka":{"m":"中","s":[["R",1,1.5],["D",1,1.5],["L",0,0,2,0],["L",0,3,2,3]]},"onna":{"m":"女","s":[["R",1,0.9],["Q",0,3,2,3,1,1.3]]},"chikara":{"m":"力","s":[["Q",0,3,2,0,0.2,0.6],["L",2,0,1.3,0.1],["L",2,0,1.9,0.8]]},"ko":{"m":"子","s":[["R",1,0.7],["L",1,1.2,1,3],["D",0.4,2],["D",1.6,2]]},"ie":{"m":"家","s":[["L",0,1,1,0],["L",1,0,2,1],["L",0.3,1,0.3,3],["L",1.7,1,1.7,3],["D",1,2.2]]},"michi":{"m":"道","s":[["Q",0,0,1,1.5,0,1.3],["Q",1,1.5,2,3,2,1.7],["D",2,0.3]]},"sora":{"m":"天","s":[["Q",0,2.6,2,2.6,1,-0.8],["D",1,2]]},"ame":{"m":"雨","s":[["Q",0,1.2,2,1.2,1,-0.5],["D",0.5,2.1],["D",1,2.8],["D",1.5,2.1]]},"ito":{"m":"糸","s":[["Q",0,0.2,2,1.4,2,0.1],["Q",2,1.4,0,2.6,0,1.5],["Q",0,2.6,2,3,1,3.3]]},"katana":{"m":"刀","s":[["L",0,3,2,0],["L",0.8,1.2,1.6,2]]},"shoku":{"m":"食","s":[["Q",0,1.5,2,1.5,1,3.4],["L",0,1.5,2,1.5],["Q",0.6,1.1,0.6,0,0.9,0.5],["Q",1.4,1.1,1.4,0,1.7,0.5]]},"tori":{"m":"鳥","s":[["Q",0,1.2,1,1.6,0.5,0.2],["Q",1,1.6,2,1.2,1.5,0.2],["D",1,2.6]]},"kemono":{"m":"獣(けもの)","s":[["L",0,1.2,2,1.2],["L",0.3,1.2,0.3,3],["L",1.7,1.2,1.7,3],["R",2,0.4]]},"sakana":{"m":"魚","s":[["Q",0,1.5,1.5,1.5,0.75,0.4],["Q",0,1.5,1.5,1.5,0.75,2.6],["L",1.5,1.5,2,0.9],["L",1.5,1.5,2,2.1],["D",0.4,1.4]]},"mushi":{"m":"虫","s":[["Q",1,0.6,1,3,0.1,1.8],["Q",1,0.6,1,3,1.9,1.8],["L",0.2,1.8,1.8,1.8],["L",0.6,0,1,0.6],["L",1.4,0,1,0.6]]},"kusa":{"m":"草","s":[["Q",0.3,3,0,1,0.3,2],["Q",1,3,1,0.4,0.8,1.7],["Q",1.7,3,2,1,1.7,2],["L",0,3,2,3]]},"ta":{"m":"田","s":[["L",0,1,2,1],["L",0,2,2,2],["L",0,3,2,3],["D",1,0.3]]},"iro":{"m":"色","s":[["R",0.55,1],["R",1.45,1],["R",1,2.1]]},"oto":{"m":"音","s":[["Q",0.4,0.6,0.4,2.4,1,1.5],["Q",1.1,0,1.1,3,2,1.5],["D",0,1.5]]},"fumi":{"m":"書","s":[["L",0.3,3,1.7,0.3],["L",1.7,0.3,2,0],["D",0.3,3],["Q",0,2.2,0.8,2.2,0.4,1.8]]},"kazu":{"m":"数","s":[["L",0,0.3,2,0.3],["D",0.5,1.3],["D",1.5,1.3],["D",0.5,2.4],["D",1.5,2.4]]},"toki":{"m":"時","s":[["R",1,1.5],["L",1,1.5,1,0.9],["L",1,1.5,1.45,1.8],["D",1,0],["D",1,3]]},"hou":{"m":"方","s":[["L",0,1.5,2,1.5],["L",2,1.5,1.3,0.8],["L",2,1.5,1.3,2.2],["D",0,1.5]]},"ou":{"m":"王","s":[["L",0,2.6,2,2.6],["L",0,2.6,0.3,0.9],["L",2,2.6,1.7,0.9],["D",1,0.6],["D",0.3,0.9],["D",1.7,0.9]]},"yami":{"m":"闇・黒(深淵)","s":[["Q",0,0,2,0,1,3.8],["D",1,1.1]]},"sei":{"m":"生","s":[["R",1,2.4],["Q",1,1.9,1,0,0.3,1],["D",1.7,0.6]]},"kami":{"m":"神","s":[["Q",0,3,2,3,1,0.9],["R",1,0.5],["D",0,3],["D",2,3]]},"tomo":{"m":"友","s":[["R",0.5,1.4],["R",1.5,1.4],["L",0.5,2.6,1.5,2.6]]},"kawa":{"m":"川","s":[["Q",0.2,0,0.2,3,0.8,1.5],["Q",1,0,1,3,1.6,1.5],["Q",1.8,0,1.8,3,2.4,1.5]]},"kaze":{"m":"風","s":[["Q",0,1,2,1,1,0.2],["Q",2,1,1,1.7,2.4,1.7],["Q",0,2.4,1.6,2.4,0.8,1.8]]},"ware":{"m":"自(じぶん)","s":[["L",0,0,0,3],["L",0,3,2,3],["D",1.2,1.4]]},"soto":{"m":"外","s":[["L",2,3,2,0],["L",2,0,0,0],["D",0.5,2.4]]},"hon":{"m":"本","s":[["L",1,0.4,1,3],["Q",1,0.4,0,0.7,0.5,0.1],["Q",1,0.4,2,0.7,1.5,0.1],["L",0,0.7,0,3],["L",2,0.7,2,3],["Q",0,3,1,3,0.5,2.6],["Q",1,3,2,3,1.5,2.6]]},"kuruma":{"m":"車","s":[["R",0.5,2.4],["R",1.5,2.4],["L",0,1.5,2,1.5]]},"fune":{"m":"船","s":[["Q",0,1.8,2,1.8,1,3.4],["L",1,1.8,1,0],["L",1,0,1.8,1.3]]},"kai":{"m":"貝","s":[["Q",0,2.5,2,2.5,1,-0.6],["L",0,2.5,2,2.5],["L",1,0.6,1,2.5],["D",1,3]]},"tama":{"m":"玉","s":[["R",1,1.5],["D",0.75,1.25]]},"kado":{"m":"角","s":[["L",0,3,2,3],["L",0,3,1.7,0.4],["Q",1.2,3,0.8,2.2,1.3,2.4]]},"yumi":{"m":"弓","s":[["Q",1.4,0,1.4,3,-0.3,1.5],["L",1.4,0,1.4,3],["D",2,1.5]]},"kome":{"m":"米","s":[["L",1,0,1,3],["D",0.4,0.8],["D",1.6,0.8],["D",0.4,2.2],["D",1.6,2.2]]},"niku":{"m":"肉","s":[["R",1,1.5],["Q",0,0.2,2,0.2,1,1],["Q",0,2.8,2,2.8,1,2]]},"atama":{"m":"頭","s":[["Q",0,2,2,2,1,-0.9],["L",0,2,2,2],["L",1,2,1,3]]},"kumo":{"m":"雲","s":[["Q",0,2,1,2,0.5,0.8],["Q",1,2,2,2,1.5,0.6],["L",0,2,2,2],["L",0.4,2.8,1.6,2.8]]},"hoshi":{"m":"星","s":[["L",1,0,1,3],["L",0,1.5,2,1.5],["L",0.4,0.6,1.6,2.4],["L",1.6,0.6,0.4,2.4],["D",1,1.5]]},"kou":{"m":"工(つくる)","s":[["L",0,0.4,2,0.4],["L",1,0.4,1,2],["R",1,2.5]]},"shin":{"m":"新","s":[["R",1,1.5],["L",1,0,1,0.8],["D",1.8,0.3],["D",0.2,0.3]]},"furu":{"m":"古","s":[["R",1,1.5],["L",0,3,2,3],["L",0.3,2.7,1.7,2.7]]},"mon":{"m":"門","s":[["L",0,0,0,3],["L",2,0,2,3],["L",0,0,0.6,0],["L",1.4,0,2,0],["D",1,0]]},"kakoi":{"m":"囲(かこい)","s":[["Q",0,0.5,2,0.5,1,-0.4],["L",0,0.5,0,3],["L",2,0.5,2,3],["L",0,3,0.7,3],["L",1.3,3,2,3]]},"z1":{"m":"0が1つ","s":[["L",0,2.4,2,2.4],["D",1.0,1.3]]},"z2":{"m":"0が2つ","s":[["L",0,2.4,2,2.4],["D",0.6666666666666666,1.3],["D",1.3333333333333333,1.3]]},"z3":{"m":"0が3つ","s":[["L",0,2.4,2,2.4],["D",0.5,1.3],["D",1.0,1.3],["D",1.5,1.3]]},"z4":{"m":"0が4つ","s":[["L",0,2.4,2,2.4],["D",0.4,1.3],["D",0.8,1.3],["D",1.2000000000000002,1.3],["D",1.6,1.3]]}},"frames":["mon","kakoi"],"grade1":"一右雨円王音下火花貝学気九休玉金空月犬見五口校左三山子四糸字耳七車手十出女小上森人水正生青夕石赤千川先早草足村大男竹中虫町天田土二日入年白八百文木本名目立力林六","grade2":"引羽雲園遠何科夏家歌画回会海絵外角楽活間丸岩顔汽記帰弓牛魚京強教近兄形計元言原戸古午後語工公広交光考行高黄合谷国黒今才細作算止市矢姉思紙寺自時室社弱首秋週春書少場色食心新親図数西声星晴切雪船線前組走多太体台地池知茶昼長鳥朝直通弟店点電刀冬当東答頭同道読内南肉馬売買麦半番父風分聞米歩母方北毎妹万明鳴毛門夜野友用曜来里理話","chars":{"人":{"l":"one","p":["hito"]},"心":{"l":"one","p":["kokoro"]},"水":{"l":"one","p":["mizu"]},"火":{"l":"one","p":["hi"]},"木":{"l":"one","p":["ki"]},"土":{"l":"one","p":["tsuchi"]},"金":{"l":"one","p":["kane"]},"日":{"l":"one","p":["nichi"]},"月":{"l":"one","p":["tsuki"]},"山":{"l":"one","p":["yama"]},"石":{"l":"one","p":["ishi"]},"口":{"l":"one","p":["kuchi"]},"目":{"l":"one","p":["me"]},"耳":{"l":"one","p":["mimi"]},"手":{"l":"one","p":["te"]},"足":{"l":"one","p":["ashi"]},"言":{"l":"one","p":["kotoba"]},"光":{"l":"one","p":["hikari"]},"虚":{"l":"one","p":["kyo"]},"大":{"l":"one","p":["dai"]},"小":{"l":"one","p":["sho"]},"上":{"l":"one","p":["ue"]},"下":{"l":"one","p":["shita"]},"中":{"l":"one","p":["naka"]},"女":{"l":"one","p":["onna"]},"力":{"l":"one","p":["chikara"]},"子":{"l":"one","p":["ko"]},"家":{"l":"one","p":["ie"]},"道":{"l":"one","p":["michi"]},"天":{"l":"one","p":["sora"]},"雨":{"l":"one","p":["ame"]},"糸":{"l":"one","p":["ito"]},"刀":{"l":"one","p":["katana"]},"食":{"l":"one","p":["shoku"]},"鳥":{"l":"one","p":["tori"]},"魚":{"l":"one","p":["sakana"]},"虫":{"l":"one","p":["mushi"]},"草":{"l":"one","p":["kusa"]},"田":{"l":"one","p":["ta"]},"色":{"l":"one","p":["iro"]},"音":{"l":"one","p":["oto"]},"書":{"l":"one","p":["fumi"]},"数":{"l":"one","p":["kazu"]},"時":{"l":"one","p":["toki"]},"方":{"l":"one","p":["hou"]},"王":{"l":"one","p":["ou"]},"黒":{"l":"one","p":["yami"]},"生":{"l":"one","p":["sei"]},"神":{"l":"one","p":["kami"]},"友":{"l":"one","p":["tomo"]},"川":{"l":"one","p":["kawa"]},"風":{"l":"one","p":["kaze"]},"自":{"l":"one","p":["ware"]},"外":{"l":"one","p":["soto"]},"本":{"l":"one","p":["hon"]},"車":{"l":"one","p":["kuruma"]},"船":{"l":"one","p":["fune"]},"貝":{"l":"one","p":["kai"]},"玉":{"l":"one","p":["tama"]},"角":{"l":"one","p":["kado"]},"弓":{"l":"one","p":["yumi"]},"米":{"l":"one","p":["kome"]},"肉":{"l":"one","p":["niku"]},"頭":{"l":"one","p":["atama"]},"雲":{"l":"one","p":["kumo"]},"星":{"l":"one","p":["hoshi"]},"工":{"l":"one","p":["kou"]},"新":{"l":"one","p":["shin"]},"古":{"l":"one","p":["furu"]},"門":{"l":"one","p":["mon"]},"一":{"l":"tb","p":["kazu","d1"]},"二":{"l":"tb","p":["kazu","d2"]},"三":{"l":"tb","p":["kazu","d3"]},"四":{"l":"tb","p":["kazu","d4"]},"五":{"l":"tb","p":["kazu","d5"]},"六":{"l":"tb","p":["kazu","d6"]},"七":{"l":"tb","p":["kazu","d7"]},"八":{"l":"tb","p":["kazu","d8"]},"九":{"l":"tb","p":["kazu","d9"]},"十":{"l":"tb","p":["kazu","z1"]},"百":{"l":"tb","p":["kazu","z2"]},"千":{"l":"tb","p":["kazu","z3"]},"万":{"l":"tb","p":["kazu","z4"]},"右":{"l":"lr","p":["te","hou"]},"左":{"l":"lr","p":["hou","te"]},"円":{"l":"lr","p":["kane","tama"]},"気":{"l":"lr","p":["kaze","kokoro"]},"休":{"l":"lr","p":["hito","ki"]},"犬":{"l":"lr","p":["kemono","hito"]},"校":{"l":"lr","p":["ki","ie"]},"字":{"l":"lr","p":["fumi","ko"]},"村":{"l":"lr","p":["ta","ie"]},"町":{"l":"lr","p":["ie","michi"]},"男":{"l":"lr","p":["hito","chikara"]},"竹":{"l":"lr","p":["ki","kusa"]},"林":{"l":"lr","p":["ki","ki"]},"引":{"l":"lr","p":["yumi","te"]},"遠":{"l":"lr","p":["michi","dai"]},"科":{"l":"lr","p":["kome","kazu"]},"歌":{"l":"lr","p":["oto","kotoba"]},"会":{"l":"lr","p":["hito","hito"]},"海":{"l":"lr","p":["mizu","dai"]},"絵":{"l":"lr","p":["iro","fumi"]},"活":{"l":"lr","p":["mizu","sei"]},"丸":{"l":"lr","p":["tama","sho"]},"汽":{"l":"lr","p":["mizu","kaze"]},"記":{"l":"lr","p":["kotoba","fumi"]},"帰":{"l":"lr","p":["ashi","ie"]},"牛":{"l":"lr","p":["kemono","ta"]},"強":{"l":"lr","p":["yumi","chikara"]},"教":{"l":"lr","p":["hon","te"]},"近":{"l":"lr","p":["michi","sho"]},"兄":{"l":"lr","p":["dai","ko"]},"弟":{"l":"lr","p":["sho","ko"]},"姉":{"l":"lr","p":["dai","onna"]},"妹":{"l":"lr","p":["sho","onna"]},"計":{"l":"lr","p":["kotoba","kazu"]},"語":{"l":"lr","p":["kotoba","kuchi"]},"交":{"l":"lr","p":["michi","michi"]},"考":{"l":"lr","p":["kokoro","atama"]},"行":{"l":"lr","p":["ashi","michi"]},"合":{"l":"lr","p":["te","te"]},"才":{"l":"lr","p":["te","hikari"]},"細":{"l":"lr","p":["ito","sho"]},"作":{"l":"lr","p":["te","kou"]},"算":{"l":"lr","p":["kazu","te"]},"止":{"l":"lr","p":["ashi","ishi"]},"矢":{"l":"lr","p":["yumi","hou"]},"社":{"l":"lr","p":["kami","tsuchi"]},"弱":{"l":"lr","p":["chikara","kyo"]},"東":{"l":"lr","p":["hou","ki"]},"南":{"l":"lr","p":["hou","hi"]},"西":{"l":"lr","p":["hou","kane"]},"北":{"l":"lr","p":["hou","mizu"]},"声":{"l":"lr","p":["kuchi","oto"]},"切":{"l":"lr","p":["katana","sho"]},"線":{"l":"lr","p":["ito","michi"]},"組":{"l":"lr","p":["ito","te"]},"走":{"l":"lr","p":["ashi","kaze"]},"多":{"l":"lr","p":["kazu","dai"]},"太":{"l":"lr","p":["dai","dai"]},"体":{"l":"lr","p":["hito","niku"]},"知":{"l":"lr","p":["kokoro","hikari"]},"昼":{"l":"lr","p":["nichi","hikari"]},"直":{"l":"lr","p":["michi","me"]},"読":{"l":"lr","p":["me","fumi"]},"馬":{"l":"lr","p":["kemono","ashi"]},"半":{"l":"lr","p":["kazu","katana"]},"分":{"l":"lr","p":["katana","kazu"]},"歩":{"l":"lr","p":["ashi","ashi"]},"毎":{"l":"lr","p":["toki","toki"]},"明":{"l":"lr","p":["nichi","tsuki"]},"鳴":{"l":"lr","p":["kuchi","tori"]},"毛":{"l":"lr","p":["ito","kemono"]},"野":{"l":"lr","p":["tsuchi","kusa"]},"曜":{"l":"lr","p":["nichi","hoshi"]},"来":{"l":"lr","p":["michi","ware"]},"話":{"l":"lr","p":["kuchi","kotoba"]},"答":{"l":"lr","p":["kuchi","hikari"]},"首":{"l":"lr","p":["atama","michi"]},"愛":{"l":"lr","p":["kokoro","kokoro"]},"淵":{"l":"lr","p":["yami","mizu"]},"続":{"l":"lr","p":["ito","toki"]},"物":{"l":"lr","p":["tama","kou"]},"販":{"l":"lr","p":["kai","michi"]},"占":{"l":"lr","p":["hoshi","me"]},"術":{"l":"lr","p":["michi","te"]},"映":{"l":"lr","p":["nichi","iro"]},"像":{"l":"lr","p":["me","iro"]},"版":{"l":"lr","p":["ishi","fumi"]},"具":{"l":"lr","p":["kou","tama"]},"消":{"l":"lr","p":["hi","kyo"]},"解":{"l":"lr","p":["katana","kado"]},"都":{"l":"lr","p":["ie","ou"]},"個":{"l":"lr","p":["hito","kazu"]},"運":{"l":"lr","p":["michi","kuruma"]},"幅":{"l":"lr","p":["ito","dai"]},"良":{"l":"lr","p":["tama","hikari"]},"質":{"l":"lr","p":["kai","me"]},"無":{"l":"lr","p":["kyo","shita"]},"的":{"l":"lr","p":["me","tama"]},"花":{"l":"tb","p":["kusa","iro"]},"学":{"l":"tb","p":["hon","ko"]},"空":{"l":"tb","p":["sora","kyo"]},"見":{"l":"tb","p":["me","hito"]},"出":{"l":"tb","p":["soto","ashi"]},"正":{"l":"tb","p":["ou","michi"]},"青":{"l":"tb","p":["iro","mizu"]},"夕":{"l":"tb","p":["nichi","shita"]},"赤":{"l":"tb","p":["iro","hi"]},"先":{"l":"tb","p":["hou","hito"]},"早":{"l":"tb","p":["nichi","ue"]},"入":{"l":"tb","p":["naka","ashi"]},"年":{"l":"tb","p":["toki","kome"]},"白":{"l":"tb","p":["iro","hikari"]},"文":{"l":"tb","p":["kotoba","ito"]},"名":{"l":"tb","p":["kotoba","hito"]},"立":{"l":"tb","p":["hito","tsuchi"]},"羽":{"l":"tb","p":["tori","ito"]},"何":{"l":"tb","p":["kyo","kotoba"]},"夏":{"l":"tb","p":["nichi","hi"]},"回":{"l":"tb","p":["tama","michi"]},"岩":{"l":"tb","p":["yama","ishi"]},"顔":{"l":"tb","p":["atama","me"]},"京":{"l":"tb","p":["ie","ou"]},"形":{"l":"tb","p":["kado","tama"]},"元":{"l":"tb","p":["sei","tsuchi"]},"原":{"l":"tb","p":["kusa","tsuchi"]},"午":{"l":"tb","p":["nichi","naka"]},"後":{"l":"tb","p":["hou","shita"]},"前":{"l":"tb","p":["hou","ue"]},"広":{"l":"tb","p":["dai","tsuchi"]},"高":{"l":"tb","p":["ue","ie"]},"黄":{"l":"tb","p":["iro","kane"]},"今":{"l":"tb","p":["toki","naka"]},"市":{"l":"tb","p":["kai","ie"]},"思":{"l":"tb","p":["atama","kokoro"]},"紙":{"l":"tb","p":["ki","fumi"]},"寺":{"l":"tb","p":["kami","ie"]},"室":{"l":"tb","p":["ie","naka"]},"春":{"l":"tb","p":["sei","nichi"]},"秋":{"l":"tb","p":["kome","nichi"]},"冬":{"l":"tb","p":["yami","nichi"]},"少":{"l":"tb","p":["sho","kazu"]},"場":{"l":"tb","p":["tsuchi","naka"]},"親":{"l":"tb","p":["hito","ko"]},"晴":{"l":"tb","p":["nichi","sora"]},"雪":{"l":"tb","p":["ame","tama"]},"台":{"l":"tb","p":["kou","tsuchi"]},"地":{"l":"tb","p":["tsuchi","tsuchi"]},"茶":{"l":"tb","p":["kusa","mizu"]},"朝":{"l":"tb","p":["nichi","kusa"]},"通":{"l":"tb","p":["michi","michi"]},"店":{"l":"tb","p":["ie","kai"]},"点":{"l":"tb","p":["fumi","sho"]},"電":{"l":"tb","p":["ame","hikari"]},"当":{"l":"tb","p":["hou","naka"]},"父":{"l":"tb","p":["ie","chikara"]},"母":{"l":"tb","p":["ie","onna"]},"番":{"l":"tb","p":["kazu","ta"]},"麦":{"l":"tb","p":["kusa","kome"]},"買":{"l":"tb","p":["kai","te"]},"売":{"l":"tb","p":["kai","soto"]},"夜":{"l":"tb","p":["tsuki","yami"]},"用":{"l":"tb","p":["kou","te"]},"里":{"l":"tb","p":["ta","tsuchi"]},"理":{"l":"tb","p":["michi","kotoba"]},"深":{"l":"tb","p":["mizu","shita"]},"聖":{"l":"tb","p":["kami","hikari"]},"事":{"l":"tb","p":["te","naka"]},"業":{"l":"tb","p":["kou","chikara"]},"未":{"l":"tb","p":["toki","kyo"]},"屋":{"l":"tb","p":["ie","ie"]},"号":{"l":"tb","p":["kuchi","kazu"]},"営":{"l":"tb","p":["ie","hi"]},"園":{"l":"in","p":["kakoi","kusa"]},"画":{"l":"in","p":["kakoi","iro"]},"国":{"l":"in","p":["kakoi","ou"]},"週":{"l":"in","p":["kakoi","toki"]},"図":{"l":"in","p":["kakoi","kado"]},"池":{"l":"in","p":["kakoi","mizu"]},"同":{"l":"in","p":["kakoi","kazu"]},"内":{"l":"in","p":["kakoi","naka"]},"公":{"l":"in","p":["kakoi","hito"]},"戸":{"l":"in","p":["mon","sho"]},"間":{"l":"in","p":["mon","nichi"]},"聞":{"l":"in","p":["mon","mimi"]},"闇":{"l":"in","p":["mon","yami"]},"森":{"l":"lmr","p":["ki","ki","ki"]},"谷":{"l":"lmr","p":["yama","kawa","yama"]},"楽":{"l":"tb","p":["oto","kokoro"]},"長":{"l":"tb","p":["ito","dai"]}}});
