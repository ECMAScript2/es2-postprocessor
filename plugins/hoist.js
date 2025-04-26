/**
 *  Hoisting
 *  @see https://developer.mozilla.org/ja/docs/Glossary/Hoisting
 * 
 *  1. Lebeled Statement Block を即時実行関数に書き変える時に var が閉じ込められるのを防ぐ
 *  2. 散在する var を集めることでコード量を減らす
 *
 *  function(){
 *    console.log('')
 *    function a(){}
 *    if(b){
 *      var c=1
 *    }
 *  }
 * ↓
 *  function(){
 *    function a(){}
 *    var c;
 *    console.log('')
 *    if(b){
 *      c=1
 *    }
 *  }
 */

const esprima    = require( 'esprima'    );
const estraverse = require( 'estraverse' );
const { replaceASTNode, removeASTNode } = require( './util.js' );

module.exports = function( ast ){
    /**
     * for(var a in b)
     *     ^^^^^
     */
    function isForInLeft( astNode, parent ){
        return parent && parent.type === esprima.Syntax.ForInStatement && parent.left === astNode;
    };
    /**
     * for(var a=0; a; ++a)
     *     ^^^^^^^
     */
    function isForInit( astNode, parent ){
        return parent && parent.type === esprima.Syntax.ForStatement && parent.init === astNode;
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
                    let functionDeclarationIndex = 0;
                    const functionDeclarations = [];
                    const root = rootASTNode.type === esprima.Syntax.Program ? rootASTNode : rootASTNode.body;

                /**
                 * 1. FunctionDeclaration を先頭に集める
                 * 2. VariableDeclaration の数を数える.
                 * 3. 最初の VariableDeclaration を取得する．但し forIn, while, (doWhile), if, switch, LabeledStatementBlock 到達しないコードをスキップする．
                 * 4. 最初の VariableDeclaration を取得できなければ先頭に挿入する．
                 * 5. 最初の VariableDeclaration に変数宣言を集める
                 */
                    // 1.
                    estraverse.traverse(
                        root,
                        {
                            enter : function( astNode, parent ){
                                if( isFunction( astNode ) ){
                                    if( astNode.type === esprima.Syntax.FunctionDeclaration ){
                                        functionDeclarations.push( astNode, parent );
                                    };
                                    return estraverse.VisitorOption.Skip;
                                };
                            }
                        }
                    );
                    while( functionDeclarations.length ){
                        const astNode = functionDeclarations.shift();
                        const parent  = functionDeclarations.shift();
                        if( astNode !== root.body[ functionDeclarationIndex ] ){
                            removeASTNode( parent, astNode );
                            root.body.splice( functionDeclarationIndex, 0, astNode );
                        };
                        ++functionDeclarationIndex;
                    };

                    estraverse.traverse(
                        root,
                        {
                            enter : function( astNode, parent ){
                                if( isVar( astNode ) ){ // var a
                                    numVariableDeclarator += astNode.declarations.length;
                                    return estraverse.VisitorOption.Skip;
                                } else if( isFunction( astNode ) ){
                                    return estraverse.VisitorOption.Skip;
                                };
                            }
                        }
                    );
                    if( numVariableDeclarator ){
                        let firstVariableDeclaration;

                        estraverse.traverse(
                            root,
                            {
                                enter : function( astNode, parent ){
                                    if( isVar( astNode ) ){
                                        firstVariableDeclaration = astNode;
                                        return estraverse.VisitorOption.Break;
                                    } else if( isFunction( astNode ) || astNode.type === esprima.Syntax.LabeledStatement ){
                                        return estraverse.VisitorOption.Skip;
                                    } else if( astNode === root ){
                                        return;
                                    };
                                }
                            }
                        );
                        if( !firstVariableDeclaration ){
                            firstVariableDeclaration = {
                                type         : esprima.Syntax.VariableDeclaration,
                                declarations : [],
                                kind         : 'var'
                            };
                            root.body.splice( functionDeclarationIndex, 0, firstVariableDeclaration );
                        };

                        estraverse.traverse(
                            root,
                            {
                                enter : function( astNode, parent ){
                                    if( isVar( astNode ) ){ // var a
                                        if( firstVariableDeclaration !== astNode ){
                                            if( isForInLeft( astNode, parent ) ){
/**
 * 
 * for(a in b){}
 * ↓
 * {
 *   type: 'ForInStatement',
 *   left: Identifier { type: 'Identifier', name: 'a' },
 *   right: Identifier { type: 'Identifier', name: 'b' },
 *   body: BlockStatement { type: 'BlockStatement', body: [] },
 *   each: false
 * }
 * 
 * for(var a in b){}
 * ↓
 * {
 *   type: 'ForInStatement',
 *   left: {
 *     type: 'VariableDeclaration',
 *     declarations: [
 *       {
 *         type: 'VariableDeclarator',
 *         id: [Identifier],
 *         init: null
 *       }
 *     ],
 *     kind: 'var'
 *   },
 *   right: Identifier { type: 'Identifier', name: 'b' },
 *   body: BlockStatement { type: 'BlockStatement', body: [] },
 *   each: false
 * }
 */
                                                const variableDeclarator = astNode.declarations[ 0 ];    
                                            
                                                parent.left = variableDeclarator.id;
                                                firstVariableDeclaration.declarations.push( variableDeclarator );
                                            } else {
                                                const declarations = astNode.declarations;
                                                const assignments  = [];
                                                const sequence     = { type : esprima.Syntax.SequenceExpression, expressions : assignments };

                                                while( declarations.length ){
                                                    const variableDeclarator = declarations.shift();

                                                    firstVariableDeclaration.declarations.push( variableDeclarator );
                                                    if( variableDeclarator.init ){
                                                        assignments.push(
                                                            {
                                                                type     : esprima.Syntax.AssignmentExpression,
                                                                operator : '=',
                                                                left     : variableDeclarator.id,
                                                                right    : variableDeclarator.init
                                                            }
                                                        );
                                                        variableDeclarator.init = null
                                                    };
                                                };
                                                if( isForInit( astNode, parent ) ){
                                                    if( assignments.length === 1 ){
                                                        parent.init = assignments[ 0 ];
                                                    } else if( assignments.length ){
                                                        parent.init = sequence;
                                                    } else {
                                                        parent.init = null;
                                                    };
                                                } else {
                                                    if( assignments.length === 1 ){
                                                        replaceASTNode( parent, astNode, { type : esprima.Syntax.ExpressionStatement, expression : assignments[ 0 ] } );
                                                    } else if( assignments.length ){
                                                        replaceASTNode( parent, astNode, { type : esprima.Syntax.ExpressionStatement, expression : sequence } );
                                                    } else {
                                                        removeASTNode( parent, astNode );
                                                    };
                                                };
                                            };
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