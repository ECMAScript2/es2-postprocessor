const test = require('ava');
const e2pp = require('../index.js');

const ie4_opr8 = {
    minIEVersion    : 4,
    minOperaVersion : 8
};

const ie6_opr7 = {
    minIEVersion    : 6,
    minOperaVersion : 7
};

test('instanceof', (t) => {
    t.throws(()=> e2pp('a instanceof b', ie4_opr8));
});
test('in operator', (t) => {
    t.throws(()=> e2pp('"a" in b', ie4_opr8));
    t.throws(()=> e2pp('"a" in b', ie6_opr7));
});
test('try~catch, throw', (t) => {
    t.throws(()=> e2pp('try{ a=1 }catch(O_o){ b=1 }', ie4_opr8));
    t.throws(()=> e2pp('throw "O_o"', ie4_opr8));
});