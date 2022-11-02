const test = require('ava');
const $ = require('../index.js');

const ie5_opr75 = {
    minIEVersion    : 5,
    minOperaVersion : 7.5
};

const ie5_opr70 = {
    minIEVersion    : 5,
    minOperaVersion : 7
};

test('Object Literal', (t) => {
    t.is($('a={1:1};', ie5_opr75), 'a={"1":1};');

    t.throws(() => $('a={1:1};', ie5_opr70));
    t.throws(() => $('a={"1":1};', ie5_opr70));
    t.throws(() => $('a={"":1};', ie5_opr70));
});