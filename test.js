require('estraverse').traverse(
    require('esprima').parse('function a(){}'),
    {
        enter : function( astNode, parent ){
            // console.log(astNode);
        }
    }
);

console.log(
    require('./index.js')(
        '/* opera */a:{k=0;if(c){break a;}b=5};',
        {
            minIEVersion    : 5,
            minOperaVersion : 7
        }
    )
);