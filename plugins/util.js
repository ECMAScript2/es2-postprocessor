const esprima    = require( 'esprima'    );
const estraverse = require( 'estraverse' );

module.exports = {};

module.exports.replaceASTNode = replaceASTNode;
module.exports.removeASTNode = removeASTNode;
module.exports.generateUnusedIdentifierName = generateUnusedIdentifierName;

function replaceASTNode( parent, oldNode, newNodeOrNodeList ){
    for( const key in parent ){
        if( Array.isArray( parent[ key ] ) ){
            const index = parent[ key ].indexOf( oldNode );
            if( 0 <= index ){
                if( Array.isArray( newNodeOrNodeList ) ){
                    [].splice.apply( parent[ key ], [ index, 1 ].concat( newNodeOrNodeList ) );
                } else {
                    parent[ key ].splice( index, 1, newNodeOrNodeList );
                };
                return;
            };
        } else if( parent[ key ] === oldNode ){
            if( Array.isArray( newNodeOrNodeList ) ){
                parent[ key ] = { type : esprima.Syntax.BlockStatement, body : newNodeOrNodeList };
            } else {
                parent[ key ] = newNodeOrNodeList;
            };
            return;
        };
    };
    console.dir(parent);
    throw new Error( 'Failed to replace AST Node!' );
};

function removeASTNode( parent, oldNode ){
    for( const key in parent ){
        if( Array.isArray( parent[ key ] ) ){
            const index = parent[ key ].indexOf( oldNode );
            if( 0 <= index ){
                parent[ key ].splice( index, 1 );
                return;
            };
        } else if( parent[ key ] === oldNode ){
            parent[ key ] = null;
            return;
        };
    };
    console.dir(parent);
    throw new Error( 'Failed to replace AST Node!' );
};

function generateUnusedIdentifierName( ast ){
    let name = '', chr = 'a', index = 0;

    const variableNames = ast._variableNames || [],
            charCodeStart = chr.charCodeAt( 0 );

    if( variableNames.length === 0 ){
        estraverse.traverse(
            ast,
            {
                enter : function( astNode, parent ){
                    if( astNode.type === esprima.Syntax.BreakStatement ){ // break ID; は含めない!
                        return estraverse.VisitorOption.Skip;
                    };
                    if( astNode.type === esprima.Syntax.Identifier ){
                        variableNames.push( astNode.name );
                    };
                }
            }
        );
    };

    while( 0 <= variableNames.indexOf( name + chr ) ){
        ++index;
        if( index % 26 === 0 ){
            name += String.fromCharCode( charCodeStart + ( Math.floor( index / 26 ) % 26 ) );
        } else {
            chr = String.fromCharCode( charCodeStart + ( index % 26 ) );
        };
    };
    name += chr;
    ast._variableNames = variableNames;

    variableNames.push( name );
    return name;
};