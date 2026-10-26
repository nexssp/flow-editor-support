// Tree-sitter grammar for Nexss Flow editor syntax.
// This grammar is intentionally structural and permissive: the Flow compiler
// is authoritative for semantics, while editors should remain useful as users
// type incomplete or extension-defined actions.
module.exports = grammar({
  name: 'flow',
  extras: $ => [/\s+/, $.comment],
  word: $ => $.identifier,
  externals: $ => [
    $.rust_language_block_content,
    $.language_block_content,
    $.language_inline_double_content,
    $.language_inline_single_content,
    $.language_inline_backtick_content,
  ],
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
      $.language_inline,
      $.language_block,
      $.template_render,
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

    language_block: $ => prec(20, choice(
      seq(choice('rust', 'rs'), '{', optional($.rust_language_block_content), '}'),
      seq(
        choice('py', 'python', 'py2', 'python2', 'py3', 'python3', 'php', 'typescript', 'ts', 'javascript', 'js', 'go', 'golang'),
        '{',
        optional($.language_block_content),
        '}',
      ),
    )),

    language_inline: $ => prec(20, seq(
      choice('py', 'python', 'py2', 'python2', 'py3', 'python3', 'rust', 'rs', 'php', 'typescript', 'ts', 'javascript', 'js', 'go', 'golang'),
      choice(
        seq('"', optional($.language_inline_double_content), '"'),
        seq("'", optional($.language_inline_single_content), "'"),
        seq('`', optional($.language_inline_backtick_content), '`'),
      ),
    )),

    template_render: $ => prec(20, seq(
      token(prec(2, 'template.render')),
      $.template_render_argument_block,
    )),
    template_render_argument_block: $ => seq('@', $.template_render_projection),
    template_render_projection: $ => seq('{', repeat(choice(
      $.template_render_template_field,
      $.projection_field,
      $._block_item,
    )), '}'),
    template_render_template_field: $ => prec(3, seq(
      'template', ':', repeat1(choice($.template_string, $._value_item)),
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
    template_string: $ => choice(
      seq(token(prec(1, '"')), repeat(choice(
        $.template_action, $.template_double_text, $.template_brace, $.template_escape,
      )), token(prec(1, '"'))),
      seq(token(prec(1, "'")), repeat(choice(
        $.template_action, $.template_single_text, $.template_brace, $.template_escape,
      )), token(prec(1, "'"))),
      seq(token(prec(1, '`')), repeat(choice(
        $.template_action, $.template_backtick_text, $.template_brace, $.template_escape,
      )), token(prec(1, '`'))),
    ),
    template_action: $ => seq(
      $.template_action_open,
      optional($.template_trim_marker),
      repeat(choice(
        $.template_keyword,
        $.template_variable,
        $.template_dot,
        $.template_identifier,
        $.template_inner_string,
        $.template_operator,
        $.template_action_content,
      )),
      optional($.template_trim_marker),
      $.template_action_close,
    ),
    template_action_open: _ => token(prec(3, '{{')),
    template_action_close: _ => token(prec(3, '}}')),
    template_trim_marker: _ => token(prec(2, '-')),
    template_keyword: _ => token(prec(2, choice(
      'range', 'end', 'if', 'else', 'with', 'template', 'block', 'define', 'break', 'continue',
    ))),
    template_variable: _ => token(prec(3, /\$(?:[A-Za-z_][A-Za-z0-9_]*|\.[A-Za-z_][A-Za-z0-9_]*)|\.[A-Za-z_][A-Za-z0-9_]*/)),
    template_dot: _ => token('.'),
    template_identifier: _ => token(prec(1, /[A-Za-z_][A-Za-z0-9_]*/)),
    template_inner_string: _ => token(/"(?:[^"\\]|\\.)*"|'(?:[^'\\]|\\.)*'|`(?:[^`\\]|\\.)*`/),
    template_operator: _ => token(prec(2, choice(':=', '==', '!=', '<=', '>=', '|', ',', ':', '=', '<', '>', '+', '-', '*', '/'))),
    template_action_content: _ => token(prec(-1, /[^{}\s]+/)),
    template_double_text: _ => token(prec(-1, /[^"\\{}]+/)),
    template_single_text: _ => token(prec(-1, /[^'\\{}]+/)),
    template_backtick_text: _ => token(prec(-1, /[^`\\{}]+/)),
    template_brace: _ => token(prec(-1, /[{}]/)),
    template_escape: _ => token(/\\./),
    number: $ => /-?[0-9]+(?:\.[0-9]+)?/,
    operator: $ => choice('->', '||', '&&', '==', '!=', '>=', '<=', '|', '&', '?', '+', '-', '*', '/', '%', '>', '<', '=', '!'),
    punctuation: $ => choice(':', ',', '.', ';', '$'),
    comment: $ => token(seq('//', /[^\n]*/)),
    raw_char: $ => token(prec(-1, /[^\s]/)),
  },
});
