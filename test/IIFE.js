const test = require('ava');
const e2pp = require('../index.js');

const ie5_opr70 = {
    minIEVersion    : 5,
    minOperaVersion : 7,
    minGeckoVersion : 0.6
};

test('IIFE x1', (t) => {
    t.is(e2pp('(function(){(function(a,b){})(a,b)})()', ie5_opr70), '(function(){function c(a,b){};c(a,b);(c=!1);}());');
});

test('IIFE x2', (t) => {
    t.is(e2pp('(function(){(function(a,b){})(a,b);(function(a,b){})(a,b)})()', ie5_opr70), '(function(){function c(a,b){};c(a,b);(c=!1);(function(a,b){}(a,b));}());');
});

test('IIFE', (t) => {
    t.is(e2pp('(function(a){true?(a=function(){}):false})()', ie5_opr70), '(function(a){true?a=function(){}:false;}());');
});

test('No Change', (t) => {
    t.is(e2pp('(function(){(function(a,b){})(a,b);function c(){}})()', ie5_opr70), '(function(){(function(a,b){}(a,b));function c(){}}());');
});