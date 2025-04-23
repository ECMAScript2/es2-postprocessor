const esprima    = require( 'esprima'    );
const estraverse = require( 'estraverse' );
const escodegen  = require( './plugins/escodegen.js' );
const hoist      = require( './plugins/hoist.js' );
const releaseLabeledStatementBlock = require( './plugins/releaseLabeledStatementBlock.js' );
const fixFunctionExpressionUnderParenthesesBug = require( './plugins/fixFunctionExpressionUnderParenthesesBug.js' );

module.exports = process;

function process( source, opt_options ){
    const options         = opt_options             || {};
    const minIEVersion    = options.minIEVersion    || 5.5;
    const minOperaVersion = options.minOperaVersion || 8;
    const minGeckoVersion = options.minGeckoVersion || 0.9;

    // Syntax
    const CANUSE_MOST_ES3_SYNTAXES          = 5   <= minIEVersion;
    const CANUSE_IN_OPERATOR                = 5.5 <= minIEVersion;
    const CANUSE_LABELED_STATEMENT_BLOCK    = 7.5 <= minOperaVersion;
    const CANUSE_FUNC_EXP_UNDER_PARENTHESES = 0.9 <= minGeckoVersion;

    const HOISTING = options.hoist || !CANUSE_LABELED_STATEMENT_BLOCK;

    // RegExp Literal
    const CANUSE_REGEXP_LITERAL              = true; // if mobileIE4 !== false
    const CANUSE_REGEXP_LITERAL_HAS_M_FLAG   = 5.5 <= minIEVersion;
    const CANUSE_REGEXP_LITERAL_HAS_G_I_FLAG = 4   <= minIEVersion;

    // Object Literal
    const CANUSE_OBJECT_LITERAL_WITH_NUMERIC_PROPERTY      = 5.5 <= minIEVersion;
    const CANUSE_OBJECT_LITERAL_WITH_EMPTY_STRING_PROPERTY = 8   <= minOperaVersion;

    const CANUSE_ALL_SYNTAXES = CANUSE_MOST_ES3_SYNTAXES && CANUSE_IN_OPERATOR &&
                                CANUSE_REGEXP_LITERAL && CANUSE_REGEXP_LITERAL_HAS_M_FLAG && CANUSE_REGEXP_LITERAL_HAS_G_I_FLAG &&
                                CANUSE_OBJECT_LITERAL_WITH_NUMERIC_PROPERTY && CANUSE_OBJECT_LITERAL_WITH_EMPTY_STRING_PROPERTY;

    if( !HOISTING && CANUSE_ALL_SYNTAXES && CANUSE_LABELED_STATEMENT_BLOCK && CANUSE_FUNC_EXP_UNDER_PARENTHESES ){
        return source;
    };

    const ast = esprima.parse( source );

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

                    if( astNode.type === esprima.Syntax.Literal && astNode.regex ){
                        if( !CANUSE_REGEXP_LITERAL ){
                            throw new SyntaxError( 'RegExp Literal uses! ' + astNode.raw );
                        };
                        if( !CANUSE_REGEXP_LITERAL_HAS_M_FLAG ){
                            if( astNode.regex.flags.match( /m/ ) ){
                                throw new SyntaxError( 'RegExp Literal with `m` flag! ' + astNode.raw );
                            };
                        };
                        if( !CANUSE_REGEXP_LITERAL_HAS_G_I_FLAG ){
                            if( astNode.regex.flags.match( /(i|g)/ ) ){
                                throw new SyntaxError( 'RegExp Literal with `i` `g` flag! ' + astNode.raw );
                            };
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

    if( HOISTING ){
        hoist( ast );
    };

    if( !CANUSE_LABELED_STATEMENT_BLOCK ){
        releaseLabeledStatementBlock( ast );
    };

    if( !CANUSE_FUNC_EXP_UNDER_PARENTHESES ){
        fixFunctionExpressionUnderParenthesesBug( ast );
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
                } catch(O_o) {
                    this.emit( 'error', new PluginError( pluginName, O_o ) );
                };
            };
            callback();
        }
    );
};
