const test = require('ava');
const $ = require('../index.js');

const ie5_opr70 = {
    minIEVersion    : 5,
    minOperaVersion : 7
};

test('Labeled Statement', (t) => {
    t.is($('a:{break a}', ie5_opr70), 'do{break;}while(!1);');

    t.is($(`
    a:{
        if(this){
            for(;k<arguments.length;++k){
                do{
                    break a;
                }while(g)
            }
        }
    }
    `, ie5_opr70), '(function(a,b){if(a){for(;k<b.length;++k){do{return;}while(g);}}}(this,arguments));');

    t.is($(`
    a:{
        if(this){
            for(;k;++k){
                do{
                    break a;
                }while(g)
            }
        }
    }
    `, ie5_opr70), '(function(a){if(a){for(;k;++k){do{return;}while(g);}}}(this));');

    t.is($(`
    a:{
        if(arguments.length){
            for(;k<arguments.length;++k){
                do{
                    break a;
                }while(g)
            }
        }
    }
    `, ie5_opr70), '(function(a){if(a.length){for(;k<a.length;++k){do{return;}while(g);}}}(arguments));');
});