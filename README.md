# es2-postprocessor

Post processor for legacy DHTML browsers.

---

Check for JavaScript Syntax Errors in IE <5.5 and Opera <8.0. Some syntax is rewritten. Otherwise, throws an `SyntaxError`.

Work around JavaScript engine bug in Gecko <=0.8.0.

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
                               compilation_level : 'WHITESPACE_ONLY', // Prevent replacing to labeled statement blocks.
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

### Options

| Property              | Description                                                         | Default value |
|:----------------------|:--------------------------------------------------------------------|--------------:|
| `minIEVersion`        | Set `4` to fix syntax errors or warnings that occurs in IE4.        | `5.5`         |
| `minOperaVersion`     | Set `7` to fix syntax errors or warnings that occurs in Opera 7.    | `8.0`         |
| `minGeckoVersion`     | Set `0.6` to work around a bug that occurs in Gecko ~0.8.0.         | `0.9`         |
| `clone`               | Set `true` to compare the before and after code.                    | `false`       |
| `hoist`(*1)           | Set `true` to move variable declarations to the beginning of scope. | `false`       |

1. If `hoist` is `false` but `minOperaVersion` is less than 7.5, move variable declarations to the beginning of scope.
   * [#2 When there is a var declaration inside a labeled statement block, it fails to workaround](https://github.com/ECMAScript2/es2-postprocessor/issues/2)
   * [MDN / Hoisting](https://developer.mozilla.org/en-US/docs/Glossary/Hoisting)

## ECMAScript3 Syntax Support Table

|                                             | Example                              | IE      | Opera   | Gecko |
|:--------------------------------------------|:-------------------------------------|:-------:|:-------:|:-----:|
| instanceof operator                         | `obj instanceof Object`              | 5(*1)   | ✔      | ✔    |
| try statement, catch statement, throw       | `try{}catch(O_o){}`                  | 5(*1)   | ✔      | ✔    |
| in operator                                 | `"length" in []`                     | 5.5(*1) | ✔      | ✔    |
| Labeled Statement Block                     | `a: {break a;}`                      | ✔      | 7.5(*2) | ✔    |
| Object Literal with Numeric Property        | `{1: 1}`                             | 5.5(*3) | ✔      | ✔    |
| RegExp Literal                              | `/reg/`                              | ✔      | ✔      | ✔    |
| RegExp Literal with `i` `g` Flags           | `/reg/ig`                            | ✔      | ✔      | ✔    |
| RegExp Literal with `m` Flag                | `/reg/m`                             | 5.5(*1) | ✔      | ✔    |

1. Just throw a Syntax Error
2. Opera ~7.2x does not support Labeled Statement Block. Therefore, es2-postprocessor rewrite for workaround. If it is too complicated, throws an error.
3. Rewrite for workaround.

## Bugs in JavaScript implementation

|                                           | Example                              | IE | Opera | Gecko     |
|:------------------------------------------|:-------------------------------------|:--:|:-----:|:---------:|
| Object Literal with Empty String Property | `{"": ""}`                           | ✔ | 8(*1) | ✔        |
| Function expression under parentheses     | `function c(){};(function(){c()})()` | ✔ | ✔    | 0.8.1(*2) |

1. Throw a Syntax Error. Object Literal with Empty String Property is problematic in Opera 7.x.
2. Gecko ~0.8.0 has a bug in Function expression under parentheses. Therefore, es2-postprocessor rewrite for workaround. It can be tested with the "[Javascript 実装状況と深刻なバグ > IIFE](https://itozyun.github.io/web-doc-base/test/javascript-implementation.html#iife)".

### Object Literal with Empty String Property in Opera ~7.2x.

~~~js
obj = {"":"Good!"} //  Object Literal
obj[""] // == undefined
obj["0"] // == "Good!"

obj[""] = "Good!"; // Set empty string property
obj[""] // == "Good!"
~~~
It can be tested with the "[Javascript 実装状況と深刻なバグ](https://itozyun.github.io/web-doc-base/test/javascript-implementation.html) > Object Litearl".

## Dynamic Rewriting `escodegen`

`es2-postprocessor` Rewrite [line 814 of escodegen](https://github.com/estools/escodegen/blob/7a48a218cff99cd38e38e54ac8f310196314702e/escodegen.js#L814). This is being done dynamically.

~~~js
result = parenthesize(generateVerbatimString(verbatim), Precedence.Sequence, precedence);
// ↓
result = generateVerbatimString(verbatim);
~~~

## Links

1. [es2-postprocessorでOpera8未満、IE5.5未満でも動くJavaScriptを書く](//outcloud.blogspot.com/2022/11/es2-postprocessor.html)
2. [エイプリルフール企画などでレガシーブラウザ対応する場合に覚えておきたい最初期のDHTMLブラウザのJavaScriptの罠たちを回避する](//outcloud.blogspot.com/2022/12/support-early-dhtml-browsers.html)

## License

es2-postprocessor is licensed under [MIT License](https://opensource.org/licenses/MIT).

(C) 2022-2024 [itozyun](https://github.com/itozyun)([outcloud.blogspot.com](//outcloud.blogspot.com/))
