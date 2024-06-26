const esprima    = require( 'esprima'    );
const estraverse = require( 'estraverse' );

/** @see README.md > Dynamic Rewriting `escodegen` */
const escodegen = (function(){
    const pathElements = __dirname.split( '\\' ).join( '/' ).split( '/' );
    let checkopoint = 0;

    if( pathElements[ pathElements.length - 2 ] === 'node_modules' ){
        pathElements.pop();
    } else {
        pathElements.push( 'node_modules' );
    };
    const ast = esprima.parse( require( 'fs' ).readFileSync( pathElements.join( '/' ) + '/escodegen/escodegen.js' ).toString() );

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
                            return estraverse.VisitorOption.Break;
                        };
                    };
                };
            }
        }
    );
    if( checkopoint !== -1 ){
        throw new Error( 'Rewrite `escodegen` failed!' );
    };
    return eval( '(function(){const exports={};' + require( 'escodegen' ).generate( ast ) + ';return exports})()' );
})();

module.exports = process;

const PROPERTY_FOR_TEST = '__test__';

function process( source, opt_options ){
    const options         = opt_options             || {};
    const minIEVersion    = options.minIEVersion    || 5.5;
    const minOperaVersion = options.minOperaVersion || 8;
    const minGeckoVersion = options.minGeckoVersion || 0.9;

    // Syntax
    const CANUSE_MOST_ES3_SYNTAXES       = 5 <= minIEVersion;
    const CANUSE_IN_OPERATOR             = 5.5 <= minIEVersion;
    const CANUSE_LABELED_STATEMENT_BLOCK = 7.5 <= minOperaVersion;

    const HOIST = options.hoist || !CANUSE_LABELED_STATEMENT_BLOCK;

    // RegExp Literal
    const CANUSE_REGEXP_LITERAL              = true; // if mobileIE4 !== false
    const CANUSE_REGEXP_LITERAL_HAS_M_FLAG   = 5.5 <= minIEVersion;
    const CANUSE_REGEXP_LITERAL_HAS_G_I_FLAG = 4 <= minIEVersion;

    // Object Literal
    const CANUSE_OBJECT_LITERAL_WITH_NUMERIC_PROPERTY      = 5.5 <= minIEVersion;
    const CANUSE_OBJECT_LITERAL_WITH_EMPTY_STRING_PROPERTY = 8 <= minOperaVersion;

    const WORKAROUND_FOR_IIFE_BUG = minGeckoVersion < 0.9; // < 0.8.1

    const CANUSE_ALL_SYNTAXES = CANUSE_MOST_ES3_SYNTAXES && CANUSE_IN_OPERATOR &&
                                CANUSE_REGEXP_LITERAL && CANUSE_REGEXP_LITERAL_HAS_M_FLAG && CANUSE_REGEXP_LITERAL_HAS_G_I_FLAG &&
                                CANUSE_OBJECT_LITERAL_WITH_NUMERIC_PROPERTY && CANUSE_OBJECT_LITERAL_WITH_EMPTY_STRING_PROPERTY;

    // Common AST Node
    const ASTNODE_IDENTIFER_THIS      = { type : esprima.Syntax.ThisExpression };
    const ASTNODE_IDENTIFER_ARGUMENTS = { type : esprima.Syntax.Identifier, name : 'arguments' };

    const ast = esprima.parse( source );

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

    if( !HOIST && CANUSE_ALL_SYNTAXES && CANUSE_LABELED_STATEMENT_BLOCK && !WORKAROUND_FOR_IIFE_BUG ){
        return source;
    };

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

    if( HOIST ){
        estraverse.traverse(
            ast,
            {
                enter : function( rootASTNode, parent ){
                    if( rootASTNode.type === esprima.Syntax.Program || rootASTNode.type === esprima.Syntax.FunctionExpression || rootASTNode.type === esprima.Syntax.FunctionDeclaration ){
                        let numVariableDeclarator = 0;
                        const root = rootASTNode.type === esprima.Syntax.Program ? rootASTNode : rootASTNode.body;

                        estraverse.traverse(
                            root,
                            {
                                enter : function( astNode, parent ){
                                    if( astNode.type === esprima.Syntax.VariableDeclaration ){ // var a
                                        if( !parent || ( !isForInLeft( astNode, parent ) && !isForInit( astNode, parent ) ) ){ // for(var a in b)
                                            numVariableDeclarator += astNode.declarations.length;
                                            return estraverse.VisitorOption.Skip;
                                        };
                                    };
                                    if( astNode.type === esprima.Syntax.FunctionExpression || astNode.type === esprima.Syntax.FunctionDeclaration ){
                                        return estraverse.VisitorOption.Skip;
                                    };
                                }
                            }
                        );
                        if( numVariableDeclarator ){
                            let firstVariableDeclaration = root.body[ 0 ];

                            if( firstVariableDeclaration.type !== esprima.Syntax.VariableDeclaration || firstVariableDeclaration.kind !== 'var' ){
                                firstVariableDeclaration = null;
                                estraverse.traverse(
                                    root,
                                    {
                                        enter : function( astNode, parent ){
                                            if( astNode.type === esprima.Syntax.VariableDeclaration && astNode.kind === 'var' ){
                                                firstVariableDeclaration = astNode;
                                            } else if( astNode.type === esprima.Syntax.FunctionDeclaration ){
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
                                        if( astNode.type === esprima.Syntax.VariableDeclaration && astNode.kind === 'var' ){ // var a
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
                                        };
                                        if( astNode.type === esprima.Syntax.FunctionExpression || astNode.type === esprima.Syntax.FunctionDeclaration ){
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

    if( !CANUSE_ALL_SYNTAXES ){
        estraverse.traverse(
            ast,
            {
                enter : function( astNode, parent ){
                    if( !CANUSE_MOST_ES3_SYNTAXES ){
                        if( astNode.type === esprima.Syntax.BinaryExpression && astNode.operator === 'instanceof' ){
                            throw new SyntaxError( '`instanceof` operator uses!' );
                        };
                        if( astNode.type === esprima.Syntax.TryStatement ){
                            throw new SyntaxError( '`try ~ catch` statements uses!' );
                        };
                        if( astNode.type === esprima.Syntax.ThrowStatement ){
                            throw new SyntaxError( '`throw` statements uses!' );
                        };
                    };
                    if( !CANUSE_IN_OPERATOR ){
                        if( astNode.type === esprima.Syntax.BinaryExpression && astNode.operator === 'in' ){
                            throw new SyntaxError( '`in` operator uses!' );
                        };
                    };

                    if( !CANUSE_REGEXP_LITERAL ){
                        if( astNode.type === esprima.Syntax.Literal && astNode.regex ){
                            throw new SyntaxError( 'RegExp Literal uses! ' + astNode.raw );
                        };
                    };
                    if( !CANUSE_REGEXP_LITERAL_HAS_M_FLAG ){
                        if( astNode.type === esprima.Syntax.Literal && astNode.regex && astNode.regex.flags.match( /m/ ) ){
                            throw new SyntaxError( 'RegExp Literal with `m` flag! ' + astNode.raw );
                        };
                    };
                    if( !CANUSE_REGEXP_LITERAL_HAS_G_I_FLAG ){
                        if( astNode.type === esprima.Syntax.Literal && astNode.regex && astNode.regex.flags.match( /(i|g)/ ) ){
                            throw new SyntaxError( 'RegExp Literal with `i` `g` flag! ' + astNode.raw );
                        };
                    };
                    if( parent && parent.type === esprima.Syntax.ObjectExpression ){
                        if( typeof astNode.key.value === 'number' ){
                            if( !CANUSE_OBJECT_LITERAL_WITH_NUMERIC_PROPERTY ){
                                // To Numeric String Property : fallback for IE5-
                                astNode.key.value = '' + astNode.key.value;
                                astNode.key.raw   = '"' + astNode.key.value + '"';
                            };
                        } else if( astNode.key.value === '' ){
                            if( !CANUSE_OBJECT_LITERAL_WITH_EMPTY_STRING_PROPERTY ){
                                throw new SyntaxError( 'Object Literal with Empty String Property!' );
                            };
                        };
                    };
                }
            }
        );
    };

    if( !CANUSE_LABELED_STATEMENT_BLOCK ){
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
                            [ esprima.Syntax.ForInStatement, esprima.Syntax.ForStatement, esprima.Syntax.WhileStatement ]
                        );
                        // break 不可, ただし ループ, switch に出会ったら探索しない
                        findInconvenientASTNode(
                            astNode, 'Labeled Statement cannot be rewritten because it contains a `break`!',
                            [ { type : esprima.Syntax.BreakStatement, label : null } ],
                            [ esprima.Syntax.ForInStatement, esprima.Syntax.ForStatement, esprima.Syntax.WhileStatement, esprima.Syntax.SwitchStatement ]
                        );
                        astNode.type = esprima.Syntax.DoWhileStatement,
                        astNode.test = { type : esprima.Syntax.Literal, value : false, raw : '!1' },
                        astNode._old = astNode.label.name;
                        delete astNode.label;
                    };
                    if( astNode.type === esprima.Syntax.BreakStatement && astNode.label ){
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
                                        // return <= break ID
                                        astNode.type = esprima.Syntax.ReturnStatement;
                                        astNode.argument = null; // ?
                                        delete astNode.label;
                                        return;
                                    };
                                    throw new SyntaxError( "Rewriting complex Labeled Statement is unsupported! (" + astNode.label.name + ":{ function(){} }");
                                case esprima.Syntax.DoWhileStatement :
                                    if( parent._old === astNode.label.name ){
                                        if( inLoopOrSwitch ){
                                            // return 不可、但し、function 以下は探索しない
                                            findInconvenientASTNode(
                                                parent, 'Labeled Statement cannot be rewritten because it contains a `return`!',
                                                [ { type : esprima.Syntax.ReturnStatement, _old : undefined } ],
                                                [ esprima.Syntax.FunctionDeclaration, esprima.Syntax.FunctionExpression ]
                                            );
                                            const doWhileToFunc = parent;
                                            let isThisAndArgumentsFound, variableOfThis, variableOfArguments;
                                            delete doWhileToFunc.test;
                                            doWhileToFunc.type      = esprima.Syntax.FunctionExpression;
                                            doWhileToFunc.id        = null;
                                            doWhileToFunc.generator = doWhileToFunc.expression = doWhileToFunc.async = false;
                                            if( doWhileToFunc.body.type !== esprima.Syntax.BlockStatement ){
                                                doWhileToFunc.body = { type : esprima.Syntax.BlockStatement, body : doWhileToFunc.body };
                                            };
                                            // 1. this, arguments キーワードを見つけたら、(function(a,b){})(this, arguments)
                                            // 2. body 以下に (function(){}).call(this,) があった場合、その Call パラメータまでを書き換えて以下は探索しない
                                            isThisAndArgumentsFound = findThisAndArguments( doWhileToFunc.body );
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
                                            astNode.type = esprima.Syntax.ReturnStatement; // return <= break a:
                                            astNode.argument = null;
                                        };
                                        delete astNode.label;
                                        return;
                                    };
                                    inLoopOrSwitch = true;
                                    break;
                            };
                        };
                    };
                }
            }
        );
    };

    if( WORKAROUND_FOR_IIFE_BUG ){
        // 1. 同一スコープ内の、即時実行関数と関数の存否確認
        // 2. 関数宣言無し, 即時実行関数ありならば、変換を行う
        //    1. (funciton(a,b){})(a,b) => funciton xx(a,b){}; xx(a,b);
        //    2. (a = function(){}) => funciton xx(){};(a = xx)
        //    3. 以上の変換は同一スコープの一つの即時実行関数に行えばよい
        const unusedIdentifer = generateUnusedIdentifierName( ast );

        estraverse.traverse(
            ast,
            {
                enter : function( astNode, parent ){
                    switch( astNode.type ){
                        case esprima.Syntax.Literal :
                            if( typeof astNode.value !== 'string' ){
                                break;
                            };
                        case esprima.Syntax.Identifier :
                        case esprima.Syntax.Property :
                            astNode[ PROPERTY_FOR_TEST ] = '.';
                            break;
                    };
                }
            }
        );
        estraverse.traverse(
            ast,
            {
                enter : function( rootASTNode, parent ){
                    if( rootASTNode.type === esprima.Syntax.FunctionExpression || rootASTNode.type === esprima.Syntax.FunctionDeclaration ){
                        let topASTNodeOfIIFE, parentASTNode, functionExpressionUnderParentheses, isFunctionDeclarationFound;
                        // console.log( rootASTNode )
                        estraverse.traverse(
                            rootASTNode.body,
                            {
                                enter : function( astNode, parent ){
                                    // IIFE
                                    if( !functionExpressionUnderParentheses ){
                                        if( astNode.type === esprima.Syntax.ExpressionStatement && astNode.expression.type === esprima.Syntax.CallExpression && astNode.expression.callee.type == esprima.Syntax.FunctionExpression ){
                                            parentASTNode = parent;
                                            topASTNodeOfIIFE = astNode;
                                            functionExpressionUnderParentheses = astNode.expression.callee;
                                            return estraverse.VisitorOption.Skip;
                                        };
                                        if( astNode.type === esprima.Syntax.FunctionExpression && checkUnderParentheses( this.parents(), astNode ) ){
                                            parentASTNode = parent;
                                            functionExpressionUnderParentheses = astNode;
                                            return estraverse.VisitorOption.Skip;
                                        };
                                    };
                                    if( astNode.type === esprima.Syntax.FunctionDeclaration ){
                                        isFunctionDeclarationFound = true;
                                        return estraverse.VisitorOption.Break;
                                    };
                                }
                            }
                        );

                        if( functionExpressionUnderParentheses && !isFunctionDeclarationFound ){
                            const funcExpressionToDeclaration = functionExpressionUnderParentheses;
                                  funcExpressionToDeclaration.id = { type : esprima.Syntax.Identifier, name : unusedIdentifer };
                                  funcExpressionToDeclaration.type = esprima.Syntax.FunctionDeclaration;
                            const releaseFunctionDeclaration = {
                                      type     : esprima.Syntax.AssignmentExpression,
                                      operator : '=',
                                      left     : funcExpressionToDeclaration.id,
                                      right    : { type : esprima.Syntax.Literal, value : false, raw : '!1' }
                                  };
                            const empty = { type: esprima.Syntax.EmptyStatement };
                            if( topASTNodeOfIIFE ){ // IIFE
                                topASTNodeOfIIFE.expression.callee = funcExpressionToDeclaration.id;
                                replaceASTNode( parentASTNode, topASTNodeOfIIFE, [ funcExpressionToDeclaration, empty, topASTNodeOfIIFE, releaseFunctionDeclaration, empty ] );
                            } else {
                                replaceASTNode( parentASTNode, funcExpressionToDeclaration, funcExpressionToDeclaration.id );
                                // console.log( parentASTNode );
                                if( Array.isArray( rootASTNode.body ) ){
                                    rootASTNode.body.push( funcExpressionToDeclaration, empty, releaseFunctionDeclaration, empty );
                                } else if( Array.isArray( rootASTNode.body.body ) ){
                                    rootASTNode.body.body.push( funcExpressionToDeclaration, empty, releaseFunctionDeclaration, empty );
                                };
                            };
                        };
                    };
                }
            }
        );
    };

    return escodegen.generate(
        ast,
            {
                // https://github.com/estools/escodegen/issues/1
                // https://github.com/estools/escodegen/issues/231#issuecomment-96850400
                // If you really want to avoid Unicode escapes, use {format: {escapeless: true}} as your escodegen options.
                // But the only way to use the same escapes that you used in your original code is to use the {verbatim: "raw"} option.
                verbatim : 'raw',
                format   : {
                    renumber    : true,
                    hexadecimal : true,
                    quotes      : "auto",
                    escapeless  : false,
                    compact     : true
                }
            }
        );
};

process.gulp = function( _options ){
    const PluginError = require( 'plugin-error' ),
          through     = require( 'through2'     ),
          pluginName  = 'gulp-es2-postprocessor';
    
    return through.obj(
        function( file, encoding, callback ){
            if( file.isNull() ) return callback();
    
            if( file.isStream() ){
                this.emit( 'error', new PluginError( pluginName, 'Streaming not supported' ) );
                return callback();
            };
    
            if( file.extname === '.js' ){
                try {
                    const contents = Buffer.from( process( file.contents.toString( encoding ), _options ) );

                    if( _options && _options.clone ){
                        this.push( file.clone( { contents : contents } ) );
                        file.stem += '.original';
                    } else {
                        file.contents = contents;
                    };
                    this.push( file );
                } catch(O_o){
                    this.emit( 'error', new PluginError( pluginName, O_o ) );
                };
            };
            callback();
        }
    );
};
// FunctionExpression が見つかった場合に、これが () で囲まれるならば、コードを変換する
// 親を辿っていき、Statement に出会ったらやめる
// escodegen にかけて () が出現するか？調べる
// CallExpression の param の下にいる場合、workaround は不要
function checkUnderParentheses( parents, astNodeFrom ){
    astNodeFrom[ PROPERTY_FOR_TEST ] = 'FUNCTION';

    for( let i = 0, l = parents.length; i < l; ++i ){
        const parentASTNode = parents[ l - i - 1 ];

        if( [ esprima.Syntax.FunctionDeclaration, esprima.Syntax.FunctionExpression, esprima.Syntax.ForInStatement ,
              esprima.Syntax.ForStatement       , esprima.Syntax.WhileStatement    , esprima.Syntax.SwitchStatement,
              esprima.Syntax.DoWhileStatement   , esprima.Syntax.ReturnStatement   , esprima.Syntax.IfStatement,
              esprima.Syntax.SwitchCase         , esprima.Syntax.CallExpression
            ].indexOf( parentASTNode.type ) !== -1
        ){
            break;
        };
        astNodeFrom = parentASTNode
    };
    const result = escodegen.generate( astNodeFrom, { verbatim : PROPERTY_FOR_TEST } );
    //console.log( childASTNode );
    //console.log( result );
    return result.indexOf( '(' ) !== -1;
};

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

function findInconvenientASTNode( ast, errorMessage, inconvenientIfMatch, skipIfMatch ){
    estraverse.traverse(
        ast,
        {
            enter : function( astNode, parent ){
                if( testIfASTNodeMatches( astNode, skipIfMatch ) ){
                    return estraverse.VisitorOption.Skip;
                };
                if( testIfASTNodeMatches( astNode, inconvenientIfMatch ) ){
                    throw new SyntaxError( errorMessage );
                };
            }
        }
    );

    function testIfASTNodeMatches( astNode, match ){
        if( Array.isArray( match ) ){
            for( let i = 0, l = match.length; i < l; ++i ){
                if( isMatch( match[ i ] ) ) return true;
            };
            return false;
        } else {
            return isMatch( match );
        };
    
        function isMatch( astNodeTypeOrNode ){
            if( typeof astNodeTypeOrNode === 'string' ){
                return astNodeTypeOrNode === astNode.type;
            };
            for( let key in astNodeTypeOrNode ){
                if( astNodeTypeOrNode[ key ] != astNode[ key ] ){ // != , not !==
                    return false;
                };
            };
            return true;
        };
    };
};
