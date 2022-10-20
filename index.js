// https://kitak.hatenablog.jp/entry/2014/11/15/233649
//   JSのASTを扱うライブラリをつかって、不要なeval呼び出しを除くコードを書いてみた
const esprima    = require( 'esprima'    );
const estraverse = require( 'estraverse' );

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
                        };
                    };
                };
            }
        }
    );
    // require('fs').writeFileSync('./__escodegen.js', require('escodegen').generate( ast ));
    if( checkopoint !== -1 ){
        throw 'escodegen の書き換えに失敗しました！';
    };
    return eval( '(function(){var exports={};' + require( 'escodegen' ).generate( ast ) + ';return exports;})()' );
})();

module.exports = process;

function process( source, _options ){
    const options         = _options || {};
    const minIEVersion    = options.minIEVersion    || 5;
    const minOperaVersion = options.minOperaVersion || 7;

    // 構文の制限
    const CANUSE_MOST_ES3_SYNTAXES      = 5.5 <= minIEVersion;
    const CANUSE_BREAK_IN_LABELED_BLOCK = 8   <= minOperaVersion;

    // RegExp の制限

    // Object リテラルの制限
    const CANUSE_NUMERIC_FOR_OBJECT_LITERAL_PROPERTY        = 5.5 <= minIEVersion && 7.5 <= minOperaVersion;
    const CANUSE_NUMERIC_STRING_FOR_OBJECT_LITERAL_PROPERTY = 7.5 <= minOperaVersion;
    const CANUSE_EMPTY_STRING_FOR_OBJECT_LITERAL_PROPERTY   = 7.5 <= minOperaVersion;

    const ast = esprima.parse( source );

    estraverse.traverse(
        ast,
        {
            enter : function( astNode, parent ){
                if( !CANUSE_MOST_ES3_SYNTAXES ){
                    if( astNode.type === esprima.Syntax.BinaryExpression ){
                        switch( astNode.operator ){
                            case 'instanceof' :
                            case 'in' :
                                throw astNode.operator + ' を使用しています！';
                        };
                    };
                    if( astNode.type === esprima.Syntax.TryStatement ){
                        throw 'try ~ catch を使用しています！';
                    };
                    if( astNode.type === esprima.Syntax.ThrowStatement ){
                        throw 'throw を使用しています！';
                    };
                };
                if( !CANUSE_BREAK_IN_LABELED_BLOCK ){
                    if( astNode.type === esprima.Syntax.LabeledStatement && astNode.label.name === 'c' ){
                        console.log('Label!! statement ' + astNode.label.name);
                        // console.log(parent)
                        // AST ツリーの書き替え
                        ( parent.body || parent.consequent ).splice(
                            ( parent.body || parent.consequent ).indexOf( astNode ),
                            1,
                            {
                                type : esprima.Syntax.DoWhileStatement,
                                body : astNode.body,
                                test : { type : esprima.Syntax.Literal, value : false, raw : '!1' },
                                _old : astNode.label.name
                            }
                        );
                        console.dir(parent)
                    };
                    if( astNode.type === esprima.Syntax.BreakStatement && astNode.label && astNode.label.name === 'c' ){
                        // TODO 祖先の ._old と一致しなければエラー
                        // AST ツリーの書き替え
                        astNode.label = null;
                    };
                };

                if( parent && parent.type === esprima.Syntax.ObjectExpression ){
                    if( typeof astNode.key.value === 'number' ){
                        if( !CANUSE_NUMERIC_FOR_OBJECT_LITERAL_PROPERTY ){
                            if( 7.5 <= minOperaVersion ){
                                // To Numeric String Property : fallback for IE5-
                                astNode.key.value = '' + astNode.key.value;
                                astNode.key.raw   = '"' + astNode.key.value + '"';
                            } else {
                                throw 'Object Literal のプロパティに数値(' + astNode.key.value + ')が使われています！';
                            };
                        };
                    } else if( '' + ( astNode.key.value - 0 ) === astNode.key.value ){
                        if( !CANUSE_NUMERIC_STRING_FOR_OBJECT_LITERAL_PROPERTY ){
                            throw 'Object Literal のプロパティに数値文字列("' + astNode.key.value + '")が使われています！';
                        };
                    } else if( astNode.key.value === '' ){
                        if( !CANUSE_EMPTY_STRING_FOR_OBJECT_LITERAL_PROPERTY ){
                            throw 'Object Literal のプロパティに空文字列("")が使われています！';
                        };
                    };
                };
            }
        }
    );

    var lastIndex = 0;

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
                    // compact: true,
                    space       : '',
                    indent      : {
                        style                  : '',
                        base                   : 0,
                        adjustMultilineComment : false
                    },
                    parentheses : false,
                    semicolons  : false
                }
            }
        ).replace(
            /\n/g,
            function( newline, index, all ){
                if( 400 < index - lastIndex ){
                    lastIndex = index;
                    return newline;
                };
                return 0 <= '();,:?{}[]"\''.indexOf( all.charAt( index - 1 ) ) ||
                       0 <= '();,:?{}[]"\''.indexOf( all.charAt( index + 1 ) ) ? '' : ' ';
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
                    // require( 'fs' ).writeFileSync( __dirname + '/__output.js', file.contents.toString( encoding ) );
                    this.push( file );
                } catch(O_o){
                    this.emit( 'error', new PluginError( pluginName, O_o ) );
                };
            };
            callback();
        }
    );
};