const esprima    = require( 'esprima'    );
const estraverse = require( 'estraverse' );

/** @see README.md > Dynamic Rewriting `escodegen` */
const escodegen = (function(){
    const pathElements = __dirname.split( '\\' ).join( '/' ).split( '/' );
    var checkopoint = 0;

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
    return eval( '(function(){var exports={};' + require( 'escodegen' ).generate( ast ) + ';return exports})()' );
})();

module.exports = process;

function process( source, opt_options ){
    const options         = opt_options || {};
    const minIEVersion    = options.minIEVersion    || 5.5;
    const minOperaVersion = options.minOperaVersion || 8;

    // 構文の制限
    const CANUSE_MOST_ES3_SYNTAXES       = 5 <= minIEVersion;
    const CANUSE_LABELED_STATEMENT_BLOCK = 8 <= minOperaVersion;

    // RegExp の制限

    // Object リテラルの制限
    const CANUSE_OBJECT_LITERAL_WITH_NUMERIC_PROPERTY        = 5.5 <= minIEVersion && 7.5 <= minOperaVersion;
    const CANUSE_OBJECT_LITERAL_WITH_NUMERIC_STRING_PROPERTY = 7.5 <= minOperaVersion;
    const CANUSE_OBJECT_LITERAL_WITH_EMPTY_STRING_PROPERTY   = 7.5 <= minOperaVersion;

    const ASTNODE_IDENTIFER_THIS      = { type : esprima.Syntax.ThisExpression };
    const ASTNODE_IDENTIFER_ARGUMENTS = { type : esprima.Syntax.Identifier, name : 'arguments' };

    const ast = esprima.parse( source );

    estraverse.traverse(
        ast,
        {
            enter : function( astNode, parent ){
                var parents = this.parents(), pointer = 0, inLoopOrSwitch;

                function getParentASTNode(){
                    ++pointer;
                    return parents[ parents.length - pointer ];
                };

                function relaceASTNode( parent, oldNode, newNode ){
                    var key, index;

                    for( key in parent ){
                        if( Array.isArray( parent[ key ] )){
                            index = parent[ key ].indexOf( oldNode );
                            if( 0 <= index ){
                                parent[ key ].splice( index, 1, newNode );
                                return;
                            };
                        };
                    };
                    console.dir(parent);
                    throw new Error( 'Failed to replace AST Node!' );
                };

                if( !CANUSE_MOST_ES3_SYNTAXES ){
                    if( astNode.type === esprima.Syntax.BinaryExpression ){
                        switch( astNode.operator ){
                            case 'instanceof' :
                            case 'in' :
                                throw new SyntaxError( '`' + astNode.operator + '` operator uses!') ;
                        };
                    };
                    if( astNode.type === esprima.Syntax.TryStatement ){
                        throw new SyntaxError( '`try ~ catch` syntax uses!' );
                    };
                    if( astNode.type === esprima.Syntax.ThrowStatement ){
                        throw new SyntaxError( '`throw` syntax uses!' );
                    };
                };
                if( !CANUSE_LABELED_STATEMENT_BLOCK ){
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
                                        // return へ書き替え
                                        astNode.type = esprima.Syntax.ReturnStatement;
                                        astNode.argument = null;
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
                                            var doWhileToFunc = parent;
                                            delete doWhileToFunc.test;
                                            doWhileToFunc.type       = esprima.Syntax.FunctionExpression;
                                            doWhileToFunc.id         = null;
                                            doWhileToFunc.generator  = doWhileToFunc.expression = doWhileToFunc.async = false;
                                            if( doWhileToFunc.body.type !== esprima.Syntax.BlockStatement ){
                                                doWhileToFunc.body = { type : esprima.Syntax.BlockStatement, body : doWhileToFunc.body };
                                            };
                                            // 1. this, arguments キーワードを見つけたら、(function(a,b){})(this, arguments)
                                            // 2. body 以下に (function(){}).call(this,) があった場合、その Call パラメータまでを書き換えて以下は探索しない
                                            var isThisAndArgumentsFound = findThisAndArguments( doWhileToFunc.body );
                                            if( isThisAndArgumentsFound ){
                                                // 3. 短い未使用の Indentifer を求める
                                                var variableOfThis      = ( isThisAndArgumentsFound & 1 ) && generateUnusedIdentifierName( doWhileToFunc.body );
                                                var variableOfArguments = ( isThisAndArgumentsFound & 2 ) && generateUnusedIdentifierName( doWhileToFunc.body );
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
                                            relaceASTNode(
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
                };

                if( parent && parent.type === esprima.Syntax.ObjectExpression ){
                    if( typeof astNode.key.value === 'number' ){
                        if( !CANUSE_OBJECT_LITERAL_WITH_NUMERIC_PROPERTY ){
                            if( 7.5 <= minOperaVersion ){
                                // To Numeric String Property : fallback for IE5-
                                astNode.key.value = '' + astNode.key.value;
                                astNode.key.raw   = '"' + astNode.key.value + '"';
                            } else {
                                throw new SyntaxError( 'Object Literal with Numeric Property! (' + astNode.key.value + ')' );
                            };
                        };
                    } else if( '' + ( astNode.key.value - 0 ) === astNode.key.value ){
                        if( !CANUSE_OBJECT_LITERAL_WITH_NUMERIC_STRING_PROPERTY ){
                            throw new SyntaxError( 'Object Literal with Numeric String Property! ("' + astNode.key.value + '")' );
                        };
                    } else if( astNode.key.value === '' ){
                        if( !CANUSE_OBJECT_LITERAL_WITH_EMPTY_STRING_PROPERTY ){
                            throw new SyntaxError( 'Object Literal with Empty String Property! ("")' );
                        };
                    };
                };
            }
        }
    );

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
                    file.contents = Buffer.from( process( file.contents.toString( encoding ), _options ) );
                    this.push( file );
                } catch(O_o){
                    this.emit( 'error', new PluginError( pluginName, O_o ) );
                };
            };
            callback();
        }
    );
};

function findThisAndArguments( ast ){
    var isThisFound      = 0;
    var isArgumentsFound = 0;

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
    var variableNames = ast._variableNames || [];
    var name = '', chr = 'a', index = 0, charCodeStart = chr.charCodeAt( 0 );

    if( variableNames.length === 0 ){
        estraverse.traverse(
            ast,
            {
                enter : function( astNode, parent ){
                    if( astNode.type === esprima.Syntax.BreakStatement ){
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
            for( var i = 0, l = match.length; i < l; ++i ){
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
            for( var key in astNodeTypeOrNode ){
                if( astNodeTypeOrNode[ key ] != astNode[ key ] ){ // != , not !==
                    return false;
                };
            };
            return true;
        };
    };
};
