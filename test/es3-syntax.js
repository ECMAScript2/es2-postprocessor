const test = require('ava');
const e2pp = require('../index.js');

const ie4_opr70 = {
    minIEVersion    : 4,
    minOperaVersion : 7
};

test('Most ES3 Syntax', (t) => {
    t.throws(()=> e2pp('a instanceof b', ie4_opr70));
    t.throws(()=> e2pp('"a" in b', ie4_opr70));
    t.throws(()=> e2pp('try{ a=1 }catch(O_o){ b=1 }', ie4_opr70));
    t.throws(()=> e2pp('throw "O_o"', ie4_opr70));
});