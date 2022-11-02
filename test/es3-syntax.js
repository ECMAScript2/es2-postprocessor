const test = require('ava');
const $ = require('../index.js');

const ie5_opr70 = {
    minIEVersion    : 5,
    minOperaVersion : 7
};

test('Most ES3 Syntax', (t) => {
    t.throws(()=> $('a instanceof b', ie5_opr70));
    t.throws(()=> $('"a" in b', ie5_opr70));
    t.throws(()=> $('try{ a=1 }catch(O_o){ b=1 }', ie5_opr70));
    t.throws(()=> $('throw "O_o"', ie5_opr70));
});