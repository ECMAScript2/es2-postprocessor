# es2-postprocessor

Post processor for legacy DHTML browsers.

---

Check for JavaScript Syntax Errors in IE <=5 and Opera <=7.x and Gecko <=0.7.

Some syntax is rewritten. Work around JavaScript engine bug. Otherwise, throws an `SyntaxError`.

## Usage

~~~js
const es2PostProcessor = require('es2-postprocessor');

sourceForLegacyBrowsers = es2PostProcessor(source, {minIEVersion: 5, minOperaVersion: 7, minGeckoVersion: 0.6});
~~~

### gulp plugin

~~~js
gulp.task('post_process_for_ie5_and_opera7',
    function(){
        return gulp.src('main.js')
                   .pipe(
                       require('es2-postprocessor').gulp({minIEVersion: 5, minOperaVersion: 7, minGeckoVersion: 0.6})
                   ).pipe(
                       gulp.dest('dist/js/legacy')
                   );
    }
);
~~~

### gulp + es2-postprocessor + Google Closure Compiler

When formatting code with Google Closure Compiler.

~~~js
gulp.task('post_process_for_ie5_and_opera7',
    function(){
        return gulp.src('main.js')
                   .pipe(
                       require('es2-postprocessor').gulp({minIEVersion: 5, minOperaVersion: 7, minGeckoVersion: 0.6})
                   .pipe(
                       require('google-closure-compiler').gulp()(
                           {
                               compilation_level : 'WHITESPACE_ONLY', // Prevent replacing labeled blocks.
                               formatting        : 'PRETTY_PRINT', // or 'SINGLE_QUOTES'
                               js_output_file    : 'main.es2.js'
                           }
                       )
                   ).pipe(
                       gulp.dest('dist/js/legacy')
                   );
    }
);
~~~

## Options

| Property          | Description                                                                     | Default value |
|:------------------|:--------------------------------------------------------------------------------|--------------:|
| `minIEVersion`    | Set to `4` if you want to fix syntax errors or warnings that occurs in IE4.     | `5.5`         |
| `minOperaVersion` | Set to `7` if you want to fix syntax errors or warnings that occurs in Opera 7. | `8.0`         |
| `minGeckoVersion` | Set to `0.6` if you want to work around a bug that occurs in Gecko ~0.7.        | `0.8`         |

## ECMAScript3 Syntax Support Table

|                                             | Example                              | IE 4.0  | IE 5.0  | Opera 7.0~7.2x | Opera 7.5x     | Gecko ~0.7 |IE 5.5+, Opera 8+, Gecko 0.8+ |
|:--------------------------------------------|:-------------------------------------|:-------:|:-------:|:--------------:|:--------------:|:----------:|:----------------------------:|
| instanceof operator                         | `obj instanceof Object`              | ✕      | ✔      | ✔             | ✔             | ✔         | ✔                           |
| try statement, catch statement, throw       | `try{}catch(O_o){}`                  | ✕      | ✔      | ✔             | ✔             | ✔         | ✔                           |
| in operator                                 | `"length" in []`                     | ✕      | ✕      | ✕             | ✔             | ✔         | ✔                           |
| Labeled Statement Block                     | `a: {break a;}`                      | ✔      | ✔      | ✕(try to fix) | ✕(try to fix) | ✔         | ✔                           |
| Object Literal with Numeric Property        | `{1: 1}`                             | ✕(fix) | ✕(fix) | ✔             | ✔             | ✔         | ✔                           |
| RegExp Literal                              | `/reg/`                              | ✔      | ✔      | ✔             | ✔             | ✔         | ✔                           |
| RegExp Literal with `i` `g` Flags           | `/reg/ig`                            | ✕      | ✔      | ✔             | ✔             | ✔         | ✔                           |
| RegExp Literal with `m` Flag                | `/reg/m`                             | ✕      | ✕      | ✔             | ✔             | ✔         | ✔                           |

## Bugs in JavaScript implementation

|                                             | Example                              | IE 4.0  | IE 5.0  | Opera 7.0~7.2x | Opera 7.5x | Gecko ~0.7 |IE 5.5+, Opera 8+, Gecko 0.8+ |
|:--------------------------------------------|:-------------------------------------|:-------:|:-------:|:--------------:|:----------:|:----------:|:----------------------------:|
| Object Literal with Empty String Property   | `{"": ""}`                           | ✔      | ✔      | Bug(*1)        | Bug(*1)    | ✔         | ✔                           |
| IIFE                                        | `function c(){};(function(){c()})()` | ✔      | ✔      | ✔             | ✔         | Bug(fix)   | ✔                           |

### Object Literal with Empty String Property in Opera 7.x.

~~~js
obj = {"":"Good!"} //  Object Literal
obj[""] // == undefined
obj["0"] // == "Good!"

obj[""] = "Good!"; // Set empty string property
obj[""] // == "Good!"
~~~


## Dynamic Rewriting `escodegen`

`es2-postprocessor` Rewrite [line 814 of escodegen](https://github.com/estools/escodegen/blob/7a48a218cff99cd38e38e54ac8f310196314702e/escodegen.js#L814). This is being done dynamically.

~~~js
result = parenthesize(generateVerbatimString(verbatim), Precedence.Sequence, precedence);
// ↓
result = generateVerbatimString(verbatim);
~~~

## Links

1. [es2-postprocessorでOpera8未満、IE5.5未満でも動くJavaScriptを書く](//outcloud.blogspot.com/2022/11/es2-postprocessor.html)

## Author

itozyun, blog:[outcloud.blogspot.com](//outcloud.blogspot.com/)

## License

ISC
