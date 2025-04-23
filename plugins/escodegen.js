/** @see README.md > Dynamic Rewriting `escodegen` */
    
module.exports = (function(){
    const esprima    = require( 'esprima'    );
    const estraverse = require( 'estraverse' );

    const pathElements = __dirname.split( '\\' ).join( '/' ).split( '/' );

    // ../plugins
    pathElements.pop();

    if( pathElements[ pathElements.length - 2 ] === 'node_modules' ){
        pathElements.pop();
    } else {
        pathElements.push( 'node_modules' );
    };

    const pathEscodegen = pathElements.join( '/' ) + '/escodegen/';
    const ast = esprima.parse( require( 'fs' ).readFileSync( pathEscodegen + 'escodegen.js' ).toString() );

    let checkopoint = 0;

    estraverse.traverse(
        ast,
        {
            enter : function( astNode, parent ){
                if( 0 <= checkopoint ){
                    if( astNode.type === esprima.Syntax.FunctionDeclaration && astNode.id ){
                        if( checkopoint === 0 && astNode.id.name === 'generateVerbatim' ){
                            checkopoint = 1;
                        };
                    };
                    if( astNode.type === esprima.Syntax.CallExpression && astNode.callee ){
                        if( checkopoint === 1 && astNode.callee.name === 'parenthesize' ){
                            checkopoint = 2;
                        } else if( checkopoint === 2 && astNode.callee.name === 'generateVerbatimString' ){
                            checkopoint = -1;
                            parent.callee    = astNode.callee;
                            parent.arguments = astNode.arguments;
                        };
                    };
                };
                if( astNode.type === esprima.Syntax.Literal && astNode.value === './package.json' ){
                    astNode.value = pathEscodegen + 'package.json';
                    return estraverse.VisitorOption.Break;
                };
            }
        }
    );
    if( checkopoint !== -1 ){
        throw new Error( 'Rewriting `escodegen` failed!' );
    };

    return eval( '(function(){const exports={};' + require( 'escodegen' ).generate( ast ) + ';return exports})()' );
})();
