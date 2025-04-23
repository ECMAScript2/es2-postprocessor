const esprima    = require( 'esprima'    );
const estraverse = require( 'estraverse' );
const { replaceASTNode } = require( './util.js' );

module.exports = function( ast ){
    /**
     * for( var a in b)
     *      ^^^^^
     */
    function isForInLeft( astNode, parent ){
        return parent.type === esprima.Syntax.ForInStatement && parent.left === astNode;
    };
    /**
     * for( var a=0; a; ++a)
     *      ^^^^^^^
     */
    function isForInit( astNode, parent ){
        return parent.type === esprima.Syntax.ForStatement && parent.init === astNode;
    };

    function isVar( astNode ){
        return astNode.type === esprima.Syntax.VariableDeclaration && astNode.kind === 'var';
    };

    function isFunction( astNode ){
        return astNode.type === esprima.Syntax.FunctionExpression || astNode.type === esprima.Syntax.FunctionDeclaration;
    };

    estraverse.traverse(
        ast,
        {
            enter : function( rootASTNode, parent ){
                if( rootASTNode.type === esprima.Syntax.Program || isFunction( rootASTNode ) ){
                    let numVariableDeclarator = 0;
                    const root = rootASTNode.type === esprima.Syntax.Program ? rootASTNode : rootASTNode.body;

                    estraverse.traverse(
                        root,
                        {
                            enter : function( astNode, parent ){
                                if( isVar( astNode ) ){ // var a
                                    if( !parent || ( !isForInLeft( astNode, parent ) && !isForInit( astNode, parent ) ) ){ // for(var a in b)
                                        numVariableDeclarator += astNode.declarations.length;
                                        return estraverse.VisitorOption.Skip;
                                    };
                                } else if( isFunction( astNode ) ){
                                    return estraverse.VisitorOption.Skip;
                                };
                            }
                        }
                    );
                    if( numVariableDeclarator ){
                        let firstVariableDeclaration = root.body[ 0 ];

                        if( !isVar( firstVariableDeclaration ) ){
                            firstVariableDeclaration = null;
                            estraverse.traverse(
                                root,
                                {
                                    enter : function( astNode, parent ){
                                        if( isVar( astNode ) ){
                                            firstVariableDeclaration = astNode;
                                        } else if( isFunction( astNode ) ){
                                            return estraverse.VisitorOption.Skip;
                                        } else if( astNode.type === esprima.Syntax.ExpressionStatement ){
                                            return estraverse.VisitorOption.Skip;
                                        } else if( astNode.type === esprima.Syntax.EmptyStatement ){
                                            return estraverse.VisitorOption.Skip;
                                        } else if( astNode === root ){
                                            return;
                                        };
                                        return estraverse.VisitorOption.Break;
                                    }
                                }
                            );
                            if( !firstVariableDeclaration ){
                                firstVariableDeclaration = {
                                    type         : esprima.Syntax.VariableDeclaration,
                                    declarations : [],
                                    kind         : 'var'
                                };
                                root.body.unshift( firstVariableDeclaration );
                            };
                        };

                        estraverse.traverse(
                            root,
                            {
                                enter : function( astNode, parent ){
                                    if( isVar( astNode ) ){ // var a
                                        if( !isForInLeft( astNode, parent ) && !isForInit( astNode, parent ) ){
                                            if( firstVariableDeclaration !== astNode ){
                                                const declarations = astNode.declarations;
                                                const toAssignment = [];

                                                while( declarations.length ){
                                                    const variableDeclarator = declarations.shift();

                                                    firstVariableDeclaration.declarations.push( variableDeclarator );
                                                    if( variableDeclarator.init ){
                                                        // console.log(variableDeclarator)
                                                        toAssignment.push(
                                                            {
                                                                type       : esprima.Syntax.ExpressionStatement,
                                                                expression : {
                                                                    type     : esprima.Syntax.AssignmentExpression,
                                                                    operator : '=',
                                                                    left     : variableDeclarator.id,
                                                                    right    : variableDeclarator.init
                                                                }
                                                            }
                                                        );
                                                        variableDeclarator.init = null
                                                    };
                                                };
                                                if( toAssignment.length ){
                                                    replaceASTNode( parent, astNode, toAssignment );
                                                } else {
                                                    replaceASTNode( parent, astNode, { type : esprima.Syntax.EmptyStatement } );
                                                };
                                            };
                                            return estraverse.VisitorOption.Skip;
                                        };
                                    } else if( isFunction( astNode ) ){
                                        return estraverse.VisitorOption.Skip;
                                    };
                                }
                            }
                        );
                    };
                };
            }
        }
    );
};