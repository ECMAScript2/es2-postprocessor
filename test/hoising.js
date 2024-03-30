const test = require('ava');
const e2pp = require('../index.js');

const ie5_opr70 = {
    minIEVersion    : 5,
    minOperaVersion : 7,
    minGeckoVersion : 0.6
};

test('hoising 1', (t) => {
    t.is(e2pp(`
        var a;
        var b;
    `, ie5_opr70), e2pp(`
        var a, b;;
    `));
});

test('hoising 2', (t) => {
    t.is(e2pp(`
        var a;
        for( var b in c ){
            var d = 10;
        };
    `, ie5_opr70), e2pp(`
        var a, d;
        for( var b in c ){
            d = 10;
        };
    `));
});

test('hoising #2', (t) => {
    t.is(e2pp(`
        if (zc = !Wc) {
            a: {
                for (var Ke in ed) {
                    if (0 === Ke.indexOf("Moz")) {
                        var id = !0;
                        break a;
                    }
                }
                id = void 0;
            }
            zc = !!id;
        }
    `, ie5_opr70), e2pp(`
        var id;
        if (zc = !Wc) {
            (function(){
                for (var Ke in ed) {
                    if (0 === Ke.indexOf("Moz")) {
                        id = !0;
                        return;
                    }
                }
                id = void 0;
            }());
            zc = !!id;
        }
    `));
});