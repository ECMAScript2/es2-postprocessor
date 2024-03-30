const test = require('ava');
const e2pp = require('../index.js');

const ie5_opr70 = {
    minIEVersion    : 5,
    minOperaVersion : 7
};

test('Labeled Statement:do~while', (t) => {
    t.is(e2pp('a:{break a}', ie5_opr70), 'do{break;}while(!1);');
});

test('Labeled Statement:this+arguments', (t) => {
    t.is(e2pp(`
        a:{
            if(this){
                for(;k<arguments.length;++k){
                    do{
                        break a;
                    }while(g)
                }
            }
        }
    `, ie5_opr70), e2pp(`
        (function(a,b){
            if(a){
                for(;k<b.length;++k){
                    do{
                        return;
                    }while(g);
                }
            }
        }(this,arguments));
    `));
});

test('Labeled Statement:this', (t) => {
    t.is(e2pp(`
    a:{
        if(this){
            for(;k;++k){
                do{
                    break a;
                }while(g)
            }
        }
    }
    `, ie5_opr70), e2pp(`
        (function(a){
            if(a){
                for(;k;++k){
                    do{
                        return;
                    }while(g);
                }
            }
        }(this));
    `));
});

test('Labeled Statement:arguments', (t) => {
    t.is(e2pp(`
        a:{
            if(arguments.length){
                for(;k<arguments.length;++k){
                    do{
                        break a;
                    }while(g)
                }
            }
        }
    `, ie5_opr70), e2pp(`
        (function(a){
            if(a.length){
                for(;k<a.length;++k){
                    do{
                        return;
                    }while(g);
                }
            }
        }(arguments));
    `));
});

test('Labeled Statement:Nest', (t) => {
    t.is(e2pp(`
        a:{
            b: {
                break b;
                break a;
            }
            break a;
        }
    `, ie5_opr70), e2pp(`
        (function(){
            do{
                break;return;
            } while(!1);
            return;
        }());
    `));

    t.is(e2pp(`
        a:{
            b: {
                break b;
                while(c){d();};
                break a;
                (function(){})();
            }
            break a;
            while(c){d();};
            (function(){})();
        }
    `, ie5_opr70), e2pp(`
        (function(){
            do{
                break;
                while(c){
                    d();
                };
                return;
                (function(){}());
            }while(!1);
            return;
            while(c){
                d();
            };
            (function(){}());
        }());
    `));
});
/*
test('Labeled Statement:#2', (t) => {
    t.is(e2pp(`
    a:{
        for (var b in c) {
            var a = !0;
            break a;
        };
    }
    _ = !!a;
    `, ie5_opr70), 'var a;(function(){for(var b in c){a=!0;return;}}());_=!!a');
}); */

test('Labeled Statement:Error', (t) => {
    t.throws(()=> e2pp('a:{continue}', ie5_opr70));
    t.throws(()=> e2pp('a:{break}', ie5_opr70));
    t.throws(()=> e2pp('a:{while(a){return}}', ie5_opr70));
});