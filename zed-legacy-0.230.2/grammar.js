// Tree-sitter grammar source for Nexss Flow.
// Generate flow.wasm with:
//   npx tree-sitter generate zed/grammars/flow.js
//   npx tree-sitter build --wasm zed/grammars/flow.js -o zed/grammars/flow.wasm
module.exports = grammar({
  name: 'flow',
  extras: $ => [/\s/, $.comment],
  word: $ => $.identifier,
  conflicts: $ => [[$.atom], [$.expression, $.conditional], [$.projection_field], [$.modifier_value]],
  rules: {
    source_file: $ => repeat(choice($.directive, $.expression)),
    directive: $ => seq('@', $.directive_name, /[^\n]+/),
    expression: $ => choice($.conditional, $.fallback),
    conditional: $ => seq($.fallback, optional(seq('?', $.fallback))),
    fallback: $ => prec.left(1, seq($.pipe, repeat(seq('||', $.pipe)))),
    pipe: $ => prec.left(2, seq($.parallel, repeat(seq(choice('->', '|'), $.parallel)))),
    parallel: $ => prec.left(3, seq($.primary, repeat(seq('&', $.primary)))),
    primary: $ => choice($.atom, $.projection, $.group, $.loop),
    group: $ => seq('(', $.expression, ')'),
    loop: $ => seq('loop', '(', $.expression, ')', 'until', '(', $.until_expression, ')'),
    until_expression: $ => repeat1(choice($.string, $.number, $.identifier, $.operator, /[^\s()\n]+/)),
    projection: $ => seq('{', repeat(choice($.projection_field, $.string, $.number, $.identifier, $.operator, /[,]/)), '}'),
    projection_field: $ => seq($.identifier, ':', repeat1(choice($.string, $.number, $.identifier, $.operator, /[^,}]+/))),
    atom: $ => seq($.identifier, repeat(choice($.modifier, $.prompt, $.targets, $.excludes))),
    modifier: $ => seq(':', $.modifier_name, optional(seq('=', $.modifier_value))),
    modifier_value: $ => repeat1(choice($.string, $.number, $.identifier, /[^\s:(){}&?|]+/)),
    prompt: $ => seq('@', /[^\s:(){}&?|]+/),
    targets: $ => seq('#', $.identifier, repeat(seq(',', $.identifier))),
    excludes: $ => seq('~', $.identifier, repeat(seq(',', $.identifier))),
    identifier: $ => /[A-Za-z_\.][A-Za-z0-9_\.\/-]*/,
    modifier_name: $ => /[A-Za-z_][A-Za-z0-9_]*/,
    directive_name: $ => /[A-Za-z_][A-Za-z0-9_.-]*/,
    string: $ => choice(/"([^"\\]|\\.)*"/, /'([^'\\]|\\.)*'/),
    number: $ => /-?[0-9]+(\.[0-9]+)?/,
    operator: $ => choice('==', '!=', '>=', '<=', '>', '<', '+', '-', '/', '*', '.', '='),
    // `#` is a target selector after an atom; keep Tree-sitter comments unambiguous.
    comment: $ => token(seq('//', /.*/))
  }
});
