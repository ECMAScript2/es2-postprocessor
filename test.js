require('estraverse').traverse(
    require('esprima').parse('var a'),
    {
        enter : function( astNode, parent ){
            // console.log(astNode);
            require('estraverse').traverse(
                astNode,
                {
                    enter : function( astNode, parent ){
                        // console.log(astNode);
                    }
                }
            );
        }
    }
);

console.log(
    require('./index.js')(
        'a:{k=0;if(this.c){for(;k<5;++k){do{break a;}while(g)}}b=5}',
        {
            minIEVersion    : 5,
            minOperaVersion : 7
        }
    )
);