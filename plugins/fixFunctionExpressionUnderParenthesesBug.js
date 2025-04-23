    // 1. 同一スコープ内の、即時実行関数と関数の存否確認
    // 2. 関数宣言無し, 即時実行関数ありならば、変換を行う
    //    1. (funciton(a,b){})(a,b) => funciton xx(a,b){}; xx(a,b);
    //    2. (a = function(){}) => funciton xx(){};(a = xx)
    //    3. 以上の変換は同一スコープの一つの即時実行関数に行えばよい
const esprima    = require( 'esprima'    );
const estraverse = require( 'estraverse' );
const escodegen  = require( './escodegen.js' );
const { replaceASTNode, generateUnusedIdentifierName } = require( './util.js' );

module.exports = function( ast ){
    // FunctionExpression が見つかった場合に、これが () で囲まれるならば、コードを変換する
    // 親を辿っていき、Statement に出会ったらやめる
    // escodegen にかけて () が出現するか？調べる
    // CallExpression の param の下にいる場合、workaround は不要
    function isUnderParentheses( parents, astNodeFrom ){
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

    const PROPERTY_FOR_TEST = '__test__';

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
                    let parentASTNode, topASTNodeOfIIFE, functionExpressionUnderParentheses, isFunctionDeclarationFound;
                    // console.log( rootASTNode )
                    estraverse.traverse(
                        rootASTNode.body,
                        {
                            enter : function( astNode, parent ){
                                if( !functionExpressionUnderParentheses ){
                                    if( astNode.type === esprima.Syntax.ExpressionStatement && astNode.expression.type === esprima.Syntax.CallExpression && astNode.expression.callee.type == esprima.Syntax.FunctionExpression ){
                                        // IIFE(Immediately Invoked Function Expression)
                                        parentASTNode = parent;
                                        topASTNodeOfIIFE = astNode;
                                        functionExpressionUnderParentheses = astNode.expression.callee;
                                        return estraverse.VisitorOption.Skip;
                                    };
                                    if( astNode.type === esprima.Syntax.FunctionExpression && isUnderParentheses( this.parents(), astNode ) ){
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