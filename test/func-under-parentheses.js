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

test('Function expression under parentheses x1', (t) => {
    t.is(e2pp(`
        (function(){
            (function(a,b){})(a,b)
        })()`, ie5_opr70), '(function(){function c(a,b){};c(a,b);(c=!1);}());');
});

test('Function expression under parentheses x2', (t) => {
    t.is(e2pp(`
        (function(){
            (function(a,b){})(a,b);
            (function(b,a){})(b,a)
        })()`, ie5_opr70), '(function(){function c(a,b){};c(a,b);(c=!1);(function(b,a){}(b,a));}());');
});

test('Function expression under parentheses', (t) => {
    t.is(e2pp(`
        (function(a){
            true?(a=function(){}):false
        })()`, ie5_opr70), e2pp(`
        (function(a){
            true?a=function(){}:false;
        }());
    `, flat));
});

test('No Change', (t) => {
    t.is(e2pp(`
        (function(){
            (function(a,b){})(a,b);
            function c(){}
        })()`, ie5_opr70), e2pp(`
        (function(){
            function c(){}
            (function(a,b){}(a,b));
        }());
    `, flat));
});