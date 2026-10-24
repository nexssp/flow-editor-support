// Tree-sitter grammar for Nexss Flow editor syntax.
// This grammar is intentionally structural and permissive: the Flow compiler
// is authoritative for semantics, while editors should remain useful as users
// type incomplete or extension-defined actions.
module.exports = grammar({
  name: 'flow',
  extras: $ => [/\s+/, $.comment],
  word: $ => $.identifier,
  rules: {
    source_file: $ => repeat(choice(
      $.directive_block,
      $.directive,
      $.expression,
      $.argument_block,
      $.modifier,
      $.operator,
      $.punctuation,
      $.raw_char,
    )),

    directive_block: $ => prec(2, seq('@', $.directive_name, optional(':'), $.projection)),
    directive: $ => seq('@', $.directive_name, optional(':')),

    expression: $ => choice($.conditional, $.fallback),
    conditional: $ => prec.right(1, seq(
      $.fallback,
      optional(seq('?', $.fallback, optional(seq(':', $.fallback)))),
    )),
    fallback: $ => prec.left(1, seq($.pipe, repeat(seq('||', $.pipe)))),
    pipe: $ => prec.left(2, seq($.parallel, repeat(seq(choice('->', '|'), $.parallel)))),
    parallel: $ => prec.left(3, seq($.primary, repeat(seq('&', $.primary)))),

    primary: $ => choice(
      $.parallel_block,
      $.race_block,
      $.match_block,
      $.loop,
      $.atom,
      $.projection,
      $.array,
      $.group,
      $.string,
      $.number,
    ),
    atom: $ => prec.right(10, seq(
      $.identifier,
      repeat(choice($.modifier, $.prompt, $.targets, $.excludes, $.argument_block)),
    )),

    modifier: $ => prec.right(seq(':', $.modifier_name, optional(seq('=', $.modifier_value)))),
    modifier_value: $ => choice($.string, token(/[^\s:(){}&?|,]+/)),
    prompt: $ => prec(2, seq('@', /[^\s:(){}&?|,]+/)),
    targets: $ => prec.right(2, seq('#', $.identifier, repeat(seq(',', $.identifier)))),
    excludes: $ => prec.right(seq('~', $.identifier, repeat(seq(',', $.identifier)))),

    argument_block: $ => prec(4, seq('@', $.projection)),
    parallel_block: $ => prec(3, seq('parallel', $.projection)),
    race_block: $ => prec(3, seq('race', $.projection)),
    match_block: $ => prec(3, seq('match', optional($.group), $.projection)),
    projection: $ => seq('{', repeat(choice($.projection_field, $._block_item)), '}'),
    projection_field: $ => prec(2, seq($.identifier, ':', repeat1($._value_item))),
    array: $ => seq('[', repeat($._block_item), ']'),
    group: $ => seq('(', repeat($._block_item), ')'),
    loop: $ => seq('loop', '(', repeat($._block_item), ')', 'until', '(', repeat($._block_item), ')'),

    _block_item: $ => choice(
      $.directive_block,
      $.directive,
      $.expression,
      $.argument_block,
      $.modifier,
      $.operator,
      $.punctuation,
      $.raw_char,
    ),
    _value_item: $ => choice(
      $.expression,
      $.argument_block,
      $.modifier,
      $.operator,
      $.punctuation,
      $.raw_char,
    ),

    identifier: $ => /[A-Za-z_\.][A-Za-z0-9_\.\/-]*/,
    modifier_name: $ => /[A-Za-z_][A-Za-z0-9_]*/,
    directive_name: $ => /[A-Za-z_][A-Za-z0-9_.-]*/,
    string: $ => choice(
      /"([^"\\]|\\.)*"/,
      /'([^'\\]|\\.)*'/,
      /`([^`\\]|\\.)*`/,
    ),
    number: $ => /-?[0-9]+(?:\.[0-9]+)?/,
    operator: $ => choice('->', '||', '&&', '==', '!=', '>=', '<=', '|', '&', '?', '+', '-', '*', '/', '%', '>', '<', '=', '!'),
    punctuation: $ => choice(':', ',', '.', ';', '$'),
    comment: $ => token(seq('//', /[^\n]*/)),
    raw_char: $ => token(prec(-1, /[^\s]/)),
  },
});
