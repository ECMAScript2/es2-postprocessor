# es2-postprocessor

Post processor for legacy DHTML browsers.

## Usage

~~~js
const es2PostProcessor = require('es2-postprocessor');

sourceForLegacyBrowsers = es2PostProcessor(source, {minIEVersion : 5, minOperaVersion : 7});
~~~

### gulp plugin

~~~js
gulp.task('post_process_for_ie5_and_opera7',
    function(){
        return gulp.src('main.js')
                   .pipe(
                       require('es2-postprocessor').gulp({minIEVersion : 5, minOperaVersion : 7})
                   ).pipe(
                       gulp.dest('dist/js/legacy')
                   );
    }
);
~~~

### es2-postprocessor + Google Closure Compiler

When formatting code with Google Closure Compiler.

~~~js
gulp.task('post_process_for_ie5_and_opera7',
    function(){
        return gulp.src('main.js')
                   .pipe(
                       require('es2-postprocessor').gulp({minIEVersion : 5, minOperaVersion : 7})
                   .pipe(
                       require('google-closure-compiler').gulp()(
                           {
                               compilation_level : 'WHITESPACE_ONLY', // Prevent replacing labeled blocks.
                               formatting        : 'PRETTY_PRINT', // oe 'SINGLE_QUOTES'
                               js_output_file    : 'main.es2.js'
                           }
                       )
                   ).pipe(
                       gulp.dest('dist/js/legacy')
                   );
    }
);
~~~

### Options

| Property          | Description                                                                    | Default value |
|:------------------|:-------------------------------------------------------------------------------|--------------:|
| `minIEVersion`    | Set to `5` if you want to fix syntax errors or warnings that occur in IE5.     | `5.5`         |
| `minOperaVersion` | Set to `7` if you want to fix syntax errors or warnings that occur in Opera 7. | `8.0`         |

## ES3 Syntax Support Table

| Browser and Version               | Sample Code             | IE 4.0      | IE 5.0      | Opera 7.0~7.2x | Opera 7.5x  | IE 5.5+, Opera 8+ |
|:----------------------------------|:------------------------|:-----------:|:-----------:|:--------------:|:-----------:|:-----------------:|
| Most ES3 Syntaxes                 | `instanceof, in, try~`  | ✕          | ✔          | ✔             | ✔          | ✔                |
| Labeled Statement Block           | `a: { break a; }`       | ✔          | ✔          | ✕(replace)    | ✕(replace) | ✔                |
| Numeric for Object Literal        | `{ 1 : 1 }`             | ✕(replace) | ✕(replace) | ✕             | ✔          | ✔                |
| Numeric String for Object Literal | `{ "1" : 1 }`           | ✔          | ✔          | ✕             | ✔          | ✔                |
| Empty String for Object Literal   | `{ "" : "" }`           | ✔          | ✔          | ✕             | ✔          | ✔                |
