const esprima    = require( 'esprima'    );
const estraverse = require( 'estraverse' );
const { replaceASTNode, generateUnusedIdentifierName } = require( './util.js' );

module.exports = function( ast ){
    function findThisAndArguments( ast ){
        let isThisFound      = 0;
        let isArgumentsFound = 0;

        estraverse.traverse(
            ast,
            {
                enter : function( astNode, parent ){
                    if( astNode.type === esprima.Syntax.FunctionExpression || astNode.type === esprima.Syntax.FunctionDeclaration ){
                        return estraverse.VisitorOption.Skip;
                    };
                    if( astNode.type === esprima.Syntax.ThisExpression ){
                        isThisFound = 1;
                    };
                    if( astNode.type === esprima.Syntax.Identifier && astNode.name === 'arguments' ){
                        isArgumentsFound = 2;
                    };
                    if( isThisFound + isArgumentsFound === 3 ){
                        return estraverse.VisitorOption.Break;
                    };
                }
            }
        );
        return isThisFound + isArgumentsFound;
    };

    function replaceThisAndArguments( ast, varNameOfThis, varNameOfArguments ){
        estraverse.traverse(
            ast,
            {
                enter : function( astNode, parent ){
                    if( astNode.type === esprima.Syntax.FunctionExpression || astNode.type === esprima.Syntax.FunctionDeclaration ){
                        return estraverse.VisitorOption.Skip;
                    };
                    if( astNode.type === esprima.Syntax.ThisExpression ){
                        astNode.type = esprima.Syntax.Identifier;
                        astNode.name = varNameOfThis;
                    };
                    if( astNode.type === esprima.Syntax.Identifier && astNode.name === 'arguments' ){
                        astNode.name = varNameOfArguments;
                    };
                }
            }
        );
    };

    function findInconvenientASTNode( ast, errorMessage, inconvenientIfMatched, skipIfMatched ){
        function testASTNodeMatches( astNode, match ){
            function isMatch( astNodeTypeOrNode ){
                if( typeof astNodeTypeOrNode === 'string' ){
                    return astNodeTypeOrNode === astNode.type;
                };
                for( const key in astNodeTypeOrNode ){
                    if( astNodeTypeOrNode[ key ] != astNode[ key ] ){ // != , not !==
                        return false;
                    };
                };
                return true;
            };
            if( Array.isArray( match ) ){
                for( let i = 0, l = match.length; i < l; ++i ){
                    if( isMatch( match[ i ] ) ) return true;
                };
                return false;
            } else {
                return isMatch( match );
            };
        };

        estraverse.traverse(
            ast,
            {
                enter : function( astNode, parent ){
                    if( testASTNodeMatches( astNode, skipIfMatched ) ){
                        return estraverse.VisitorOption.Skip;
                    };
                    if( testASTNodeMatches( astNode, inconvenientIfMatched ) ){
                        throw new SyntaxError( errorMessage );
                    };
                }
            }
        );
    };

    // Common AST Node
    const ASTNODE_IDENTIFER_THIS      = { type : esprima.Syntax.ThisExpression };
    const ASTNODE_IDENTIFER_ARGUMENTS = { type : esprima.Syntax.Identifier, name : 'arguments' };

    estraverse.traverse(
        ast,
        {
            enter : function( astNode, parent ){
                const parents = this.parents();
                let pointer = 0, inLoopOrSwitch;

                function getParentASTNode(){
                    ++pointer;
                    return parents[ parents.length - pointer ];
                };

                if( astNode.type === esprima.Syntax.LabeledStatement ){
                    // continue 不可, ただし ループに出会ったら探索しない
                    findInconvenientASTNode(
                        astNode, 'Labeled Statement cannot be rewritten because it contains `continue`!',
                        [ esprima.Syntax.ContinueStatement ],
                        [ esprima.Syntax.FunctionDeclaration, esprima.Syntax.FunctionExpression,
                          esprima.Syntax.ForInStatement, esprima.Syntax.ForStatement, esprima.Syntax.WhileStatement ]
                    );
                    // break 不可, ただし ループ, switch に出会ったら探索しない
                    findInconvenientASTNode(
                        astNode, 'Labeled Statement cannot be rewritten because it contains a `break`!',
                        [ { type : esprima.Syntax.BreakStatement, label : null } ],
                        [ esprima.Syntax.FunctionDeclaration, esprima.Syntax.FunctionExpression,
                          esprima.Syntax.ForInStatement, esprima.Syntax.ForStatement, esprima.Syntax.WhileStatement, esprima.Syntax.SwitchStatement ]
                    );
                    astNode.type = esprima.Syntax.DoWhileStatement,
                    astNode.test = { type : esprima.Syntax.Literal, value : false, raw : '!1' },
                    astNode._old = astNode.label.name;
                    delete astNode.label;
                } else if( astNode.type === esprima.Syntax.ContinueStatement && astNode.label ){
                    throw new SyntaxError( "Release complex Labeled Statement is unsupported! (" + astNode.label.name + "");
                } else if( astNode.type === esprima.Syntax.BreakStatement && astNode.label ){
                    while( parent = getParentASTNode() ){
                        switch( parent.type ){
                            case esprima.Syntax.ForInStatement  : // for( in )
                            // case esprima.Syntax.ForOfStatement  : // for( of )
                            case esprima.Syntax.ForStatement    : // for( ;; )
                            case esprima.Syntax.WhileStatement  : // while()
                            case esprima.Syntax.SwitchStatement :
                                inLoopOrSwitch = true;
                                break;
                            case esprima.Syntax.FunctionExpression :
                                if( parent._old === astNode.label.name ){
                                    astNode.type     = esprima.Syntax.ReturnStatement; // return <= break ID
                                    astNode.argument = null; // ?
                                    astNode._old     = parent._old;
                                    delete astNode.label;
                                    return;
                                };
                                throw new SyntaxError( "Release complex Labeled Statement is unsupported! (" + astNode.label.name + ":{ function(){} }");
                            case esprima.Syntax.DoWhileStatement :
                                if( parent._old !== astNode.label.name ){
                                    inLoopOrSwitch = true;
                                } else {
                                    if( inLoopOrSwitch ){
                                        // return 不可、但し、function 以下は探索しない
                                        findInconvenientASTNode(
                                            parent, 'Labeled Statement cannot be rewritten because it contains a `return`!',
                                            [ { type : esprima.Syntax.ReturnStatement, _old : undefined } ], // break a => retuan は除く
                                            [ esprima.Syntax.FunctionDeclaration, esprima.Syntax.FunctionExpression ]
                                        );
                                        const doWhileToFunc = parent;

                                        delete doWhileToFunc.test;
                                        doWhileToFunc.type      = esprima.Syntax.FunctionExpression;
                                        doWhileToFunc.id        = null;
                                        doWhileToFunc.generator = doWhileToFunc.expression = doWhileToFunc.async = false;
                                        if( doWhileToFunc.body.type !== esprima.Syntax.BlockStatement ){
                                            doWhileToFunc.body = { type : esprima.Syntax.BlockStatement, body : doWhileToFunc.body };
                                        };
                                        // 1. this, arguments キーワードを見つけたら、(function(a,b){})(this, arguments)
                                        // 2. body 以下に (function(){}).call(this,) があった場合、その Call パラメータまでを書き換えて以下は探索しない
                                        const isThisAndArgumentsFound = findThisAndArguments( doWhileToFunc.body );
                                        let variableOfThis, variableOfArguments;

                                        if( isThisAndArgumentsFound ){
                                            // 3. 短い未使用の Indentifer を求める
                                            variableOfThis      = ( isThisAndArgumentsFound & 1 ) && generateUnusedIdentifierName( doWhileToFunc.body );
                                            variableOfArguments = ( isThisAndArgumentsFound & 2 ) && generateUnusedIdentifierName( doWhileToFunc.body );
                                            // 4. this, arguments を夫々に書き換える
                                            replaceThisAndArguments( doWhileToFunc.body, variableOfThis, variableOfArguments );
                                        };
                                        doWhileToFunc.params =
                                            isThisAndArgumentsFound === 0
                                                ? [] :
                                            isThisAndArgumentsFound === 1
                                                ? [ { type : esprima.Syntax.Identifier, name : variableOfThis } ] :
                                            isThisAndArgumentsFound === 2
                                                ? [ { type : esprima.Syntax.Identifier, name : variableOfArguments } ]
                                                : [ { type : esprima.Syntax.Identifier, name : variableOfThis },
                                                    { type : esprima.Syntax.Identifier, name : variableOfArguments } ];
                                        // do{ break; }while(false)
                                        // ↓
                                        // (function(){ return; })()
                                        replaceASTNode(
                                            getParentASTNode(),
                                            doWhileToFunc,
                                            {
                                                type       : esprima.Syntax.ExpressionStatement,
                                                expression : {
                                                    type      : esprima.Syntax.CallExpression,
                                                    callee    : doWhileToFunc,
                                                    arguments :
                                                        isThisAndArgumentsFound === 0
                                                            ? [] :
                                                        isThisAndArgumentsFound === 1
                                                            ? [ ASTNODE_IDENTIFER_THIS ] :
                                                        isThisAndArgumentsFound === 2
                                                            ? [ ASTNODE_IDENTIFER_ARGUMENTS ]
                                                            : [ ASTNODE_IDENTIFER_THIS, ASTNODE_IDENTIFER_ARGUMENTS ]
                                                }
                                            }
                                        );
                                        astNode.type     = esprima.Syntax.ReturnStatement; // return <= break ID
                                        astNode.argument = null; // ?
                                        astNode._old     = parent._old;
                                    };
                                    delete astNode.label;
                                    return;
                                };
                        };
                    };
                };
            }
        }
    );
};
