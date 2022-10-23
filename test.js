require('estraverse').traverse(
    require('esprima').parse('if(c)a=5,k=6'),
    {
        enter : function( astNode, parent ){
            console.log(astNode);
        }
    }
);

console.log(
    require('./index.js')(
        'a:{k=0;if(c){for(;k<5;++k){do{break a;}while(g)}}b=5}',
        {
            minIEVersion    : 5,
            minOperaVersion : 7
        }
    )
);