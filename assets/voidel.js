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
    var S = null;
    var V = {};
    V.load = function (json) { S = json; return V; };

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
    V.label = function (u) {
        if (u.sp) return { period: '。', comma: '、', question: '?', exclaim: '!', geminate: 'っ', long: 'ー', space: ' ' }[u.sp];
        if (u.dg !== undefined) return u.dg;
        if (u.iv) return u.iv;
        return u.c + (u.pal ? 'y' : '') + (u.v === null ? '' : u.v);
    };

    /* ---------- 描画 ---------- */
    function strokes(ctx, list, x, y, s) {
        var node = function (c, r) { return [x + (c / 2) * s, y + (r / 3) * s]; };
        ctx.lineWidth = Math.max(0.8, s * 0.07); ctx.lineCap = 'round'; ctx.lineJoin = 'round';
        list.forEach(function (st) {
            var t = st[0];
            if (t === 'L') { var a = node(st[1], st[2]), b = node(st[3], st[4]); ctx.beginPath(); ctx.moveTo(a[0], a[1]); ctx.lineTo(b[0], b[1]); ctx.stroke(); }
            else if (t === 'Q') { var a2 = node(st[1], st[2]), b2 = node(st[3], st[4]), c2 = node(st[5], st[6]); ctx.beginPath(); ctx.moveTo(a2[0], a2[1]); ctx.quadraticCurveTo(c2[0], c2[1], b2[0], b2[1]); ctx.stroke(); }
            else if (t === 'R') { var r0 = node(st[1], st[2]); ctx.beginPath(); ctx.arc(r0[0], r0[1], s * 0.16, 0, Math.PI * 2); ctx.stroke(); }
            else if (t === 'D') { var d0 = node(st[1], st[2]); ctx.beginPath(); ctx.arc(d0[0], d0[1], Math.max(1, s * 0.06), 0, Math.PI * 2); ctx.fillStyle = ctx.strokeStyle; ctx.fill(); }
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
    V.draw = function (ctx, u, x, y, s) {
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
