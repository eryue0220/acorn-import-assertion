import acorn from 'acorn';
import charCodes from 'charcodes';
import Errors from './errors.js';
import { isWhitespace } from './util.js';

const keyword = 'assert';
const { tokTypes: tt, TokenType } = acorn;
const FUNC_STATEMENT = 1;
const FUNC_NULLABLE_ID = 4;

tt._assert = new TokenType(keyword, { keyword });

export default function importAssertionPlugin(Parser) {
  return class extends Parser {
    match(type) {
      return this.type === type;
    }

    readToken(token) {
      let i = 0;
      for (; i < keyword.length; i++) {
        const code = this.input.charCodeAt(this.pos + i);
        if (code !== keyword.charCodeAt(i)) {
          return super.readToken(token);
        }
      }

      for (;;i++) {
        const code = this.input.charCodeAt(this.pos + i);
        if (code === charCodes.leftCurlyBrace) {
          break;
        } else if (isWhitespace(code)) {
          continue;
        } else {
          return super.readToken(token);
        }
      }

      this.pos += i;
      return this.finishToken(tt._assert);
    }

    parseImport(node) {
      this.next();

      // import '...'
      if (this.type === tt.string) {
        node.specifiers = [];
        node.source = this.parseExprAtom();
      } else {
        node.specifiers = this.parseImportSpecifiers();
        this.expectContextual('from');
        node.source = this.type === tt.string
          ? this.parseExprAtom()
          : this.unexpected();
      }

      if (this.type === tt._assert) {
        node.attributes = this.parseImportAssertions(node);
      }

      this.semicolon();
      return this.finishNode(node, 'ImportDeclaration');
    }

    parseDynamicImport(node) {
      this.next(); // skip '('
      node.source = this.parseMaybeAssign();

      while (!this.eat(tt.parenR)) {
        if (this.eat(tt.comma) && this.eat(tt.parenR)) {
          this.raiseRecoverABLE(node.start, Errors.ImportCallArgumentTrailingComma());
        } else if (this.match(tt.braceL)) {
          node.arguments = this.parseObj(false);
        } else {
          this.unexpected();
        }
      }

      return this.finishNode(node, 'ImportExpression');
    }

    parseImportAssertions(node) {
      const attrKeys = new Set();
      const attrs = [];
      let first = true;
      this.next();
      this.eat(tt.braceL);

      while (!this.eat(tt.braceR)) {
        if (first) {
          first = false;
        } else if (this.eat(tt.comma) && this.eat(tt.braceR)) {
          break;
        }

        const key = this.type === tt.string
          ? this.parseLiteral(this.value)
          : this.parseIdent(true);
        
        if (attrKeys.has(key.name)) {
          this.raise(node.start, Errors.DuplicateAssertionKey({ type: key.name }));
        }

        attrKeys.add(key.name);
        node.key = key;
        this.next();

        if (this.type !== tt.string) {
          this.raise(this.pos, Errors.AssertTypeError());
        }

        node.value = this.parseLiteral(this.value);
        attrs.push(this.finishNode(node, 'ImportAttribute'));
      }
      
      return attrs;
    }

    parseExport(node, exports) {
      this.next();

      // export * from '...'
      if (this.eat(tt.star)) {
        if (this.options.ecmaVersion >= 11) {
          if (this.eatContextual('as')) {
            node.exported = this.parseModuleExportName();
            this.checkExport(exports, node.exported, this.lastTokStart);
          } else {
            node.exported = null;
          }
        }
        this.expectContextual('from');
        if (this.type !== tt.string) this.unexpected();

        node.source = this.parseExprAtom();

        if (this.type === tt._assert) {
          node.attributes = this.parseImportAssertions(node);
        }

        this.semicolon();
        return this.finishNode(node, 'ExportAllDeclaration');
      } else if (this.eat(tt._default)) { // export default ...
        this.checkExport(exports, 'default', this.lastTokStart);
        let isAsync;

        if (this.type === tt._function || (isAsync = this.isAsyncFunction())) {
          const funcNode = this.startNode();
          this.next();
          if (isAsync) this.next();
          node.declaration = this.parseFunction(
            funcNode,
            FUNC_STATEMENT | FUNC_NULLABLE_ID,
            false,
            isAsync,
          );
        } else if (this.type === tt._class) {
          const classNode = this.startNode();
          node.declaration = this.parseClass(classNode, 'nullableID');
        } else {
          node.declaration = this.parseMaybeAssign();
          this.semicolon();
        }
      } else if (this.shouldParseExportStatement()) { // export const | var | let | function | class
        node.declaration = this.parseStatement(null);

        if (node.declaration.type === 'VariableDeclaration') {
          this.checkVariableExport(exports, node.declaration.declarations);
        } else {
          this.checkExport(exports, node.declaration.id, node.declaration.id.start);
        }

        node.specifiers = [];
        node.source = null;
      } else { // export { x, y as } [from '...']
        node.declaration = null;
        node.specifiers = this.parseExportSpecifiers(exports);
        if (this.eatContextual('from')) {
          if (this.type !== tt.string) {
            this.unexpected();
          }
          node.source = this.parseExprAtom();
          if (this.type === tt._assert) {
            node.attributes = this.parseImportAssertions(node);
          }
        } else {
          for (const spec of node.specifiers) {
            this.checkUnreserved(spec.local);
            this.checkLocalExport(spec.local);

            if (spec.local.type === 'Literal') {
              this.raise(spec.local.start, Errors.ExportError());
            }
          }

          node.source = null;
        }
        this.semicolon();
      }

      return this.finishNode(node, 'ExportNamedDeclaration');
    }
  };
}
