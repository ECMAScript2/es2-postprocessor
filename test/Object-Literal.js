const test = require('ava');
const e2pp = require('../index.js');7

const ie5_opr75 = {
    minIEVersion    : 5,
    minOperaVersion : 7.5
};

const ie5_opr70 = {
    minIEVersion    : 5,
    minOperaVersion : 7
};

test('Numeric Property', (t) => {
    t.is(e2pp('a={1:1};', ie5_opr75), 'a={"1":1};');
    t.is(e2pp('a={"1":1};', ie5_opr70), 'a={"1":1};');
});

test('Empty Property', (t) => {
    t.throws(() => e2pp('a={"":1};', ie5_opr70));
    t.throws(() => e2pp('a={"":1};', ie5_opr75));
});