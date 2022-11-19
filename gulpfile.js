const gulp            = require('gulp'),
      ClosureCompiler = require('google-closure-compiler').gulp();
      PluginError     = require( 'plugin-error' ),
      pluginName      = 'gulp-es2-postprocessor';

/* -------------------------------------------------------
 *  gulp prepublish
 */
const TASK_LIST = [];
const POLYFILL_LIST = [
    'Array.prototype.indexOf' , true,
    'Array.prototype.pop'     , true,
    'Array.prototype.push'    , true,
    'Array.prototype.shift'   , true,
    'Array.prototype.splice'  , true,
    'Array.prototype.unshift' , true,
    'decodeURIComponent'      , true,
    'encodeURIComponent'      , true,
    'Function.prototype.apply', false,
    'Function.prototype.call' , true
];
const POLYFILL_STORE = {};

for( let i = 0, l = POLYFILL_LIST.length; i < l; i += 2 ){
    TASK_LIST.push( createTask( POLYFILL_LIST[ i ], POLYFILL_LIST[ i + 1 ] ) );
};

TASK_LIST.push(
    function( callback ){
        require( 'fs' ).writeFile( './polyfills.json', JSON.stringify( POLYFILL_STORE, null, '    ' ), callback );
    }
);

function createTask( builtInName, isAdvanced ){
    return function(){
        return gulp.src(
                [ './.submodules/es2-to-es3/' + builtInName + '.js' ]
            ).pipe(
                ClosureCompiler(
                    {
                        compilation_level : isAdvanced ? 'ADVANCED' : 'SIMPLE',
                        warning_level     : 'VERBOSE',
                        language_in       : 'ECMASCRIPT3',
                        language_out      : 'ECMASCRIPT3',
                        js_output_file    : 'polyfill.js'
                    }
                )
            ).pipe(
                require( 'through2' ).obj(
                    function( file, encoding, callback ){
                        if( file.isNull() ) return callback();
                
                        if( file.isStream() ){
                            this.emit( 'error', new PluginError( pluginName, 'Streaming not supported' ) );
                            return callback();
                        };
                
                        try {
                            POLYFILL_STORE[ builtInName ] = file.contents.toString( encoding ).replace( /\s+$/, '' );
                        } catch(O_o){
                            this.emit( 'error', new PluginError( pluginName, O_o ) );
                        };
                        callback();
                    }
                )
            );
    };
};

gulp.task( 'prepublish', gulp.series.apply( gulp, TASK_LIST ) );
