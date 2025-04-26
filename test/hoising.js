const test = require('ava');
const e2pp = require('../index.js');

const ie5_opr70 = {
    minIEVersion    : 5,
    minOperaVersion : 7,
    minGeckoVersion : 0.6
};

const flat = {
    minIEVersion : 5
};

const hoist = {
    hoist : true
};

test('hoising 1', (t) => {
    t.is(e2pp(`
        var a;
        var b;
    `, ie5_opr70), e2pp(`
        var a, b;
    `, flat));
});

test('hoising 2', (t) => {
    t.is(e2pp(`
        var a;
        for( var b in c ){
            var d = 10;
        };
    `, ie5_opr70), e2pp(`
        var a, b, d;
        for( b in c ){
            d = 10;
        };
    `, flat));
});

test('hoising 3', (t) => {
    t.is(e2pp(`
        function _(){};
        ++g;
        var a = g+1;
        var b;
    `, ie5_opr70), e2pp(`
        function _(){};
        ++g;
        var a = g+1, b;
    `, flat));
});

test('hoising 4:for', (t) => {
    t.is(e2pp(`
        var a;
        for( var b; c; ){
            var d = 10;
        };
    `, ie5_opr70), e2pp(`
        var a, b, d;
        for( ; c; ){
            d = 10;
        };
    `, flat));

    t.is(e2pp(`
        var a;
        for( var b=1; c; ){
            var d = 10;
        };
    `, ie5_opr70), e2pp(`
        var a, b, d;
        for( b=1; c; ){
            d = 10;
        };
    `, flat));

    t.is(e2pp(`
        for( var b; c; ){
            var d = 10;
        };
    `, ie5_opr70), e2pp(`
        for( var b, d; c; ){
            d = 10;
        };
    `, flat));

    t.is(e2pp(`
        for( ; c; ){
            var d = 10;
        };
        var e;
    `, ie5_opr70), e2pp(`
        for( ; c; ){
            var d = 10, e;
        };
    `, flat));
});

test('hoising 5:Labeled Statement Block', (t) => {
    t.is(e2pp(`
        var a;
        a: {
          var b=5;
        };
    `, hoist), 'var a,b;a:{b=5;};');

    t.is(e2pp(`
        a: {
          var a=5;
        };
        var b;
    `, hoist), 'a:{a=5;};var b,a;');

    t.is(e2pp(`
        a: {
          var a=5;
          break a;
        };
        var b;
    `, ie5_opr70), e2pp(`
        do {
          a=5;
          break;
        } while(!1);;
        var b, a;
    `, flat));
});

test('hoising 6', (t) => {
    t.is(e2pp(`
        ++g;
        function a(){};
        ++g;
        function b(){};
        ++g;
        function c(){};
    `, ie5_opr70), e2pp(`
        function a(){}
        function b(){}
        function c(){}
        ++g;;
        ++g;;
        ++g;;
    `, flat));

    t.is(e2pp(`
        ++g;
        function a(){};
        ++g;
        function b(){};
        var a;
        ++g;
        function c(){};
    `, ie5_opr70), e2pp(`
        function a(){}
        function b(){}
        function c(){}
        ++g;;
        ++g;;
        var a;
        ++g;;
    `, flat));

    t.is(e2pp(`
        ++g;
        function a(){};
        ++g;
        function b(){};
        a:{
            var a
            break a;
        };
        ++g;
        function c(){};
    `, ie5_opr70), e2pp(`
        function a(){}
        function b(){}
        function c(){}
        var a;
        ++g;;
        ++g;;
        do {
            break;
        } while(!1);
        ;
        ++g;;
    `, flat));
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
        var Ke, id;
        if (zc = !Wc) {
            (function(){
                for (Ke in ed) {
                    if (0 === Ke.indexOf("Moz")) {
                        id = !0;
                        return;
                    }
                }
                id = void 0;
            }());
            zc = !!id;
        }
    `, flat));
});
