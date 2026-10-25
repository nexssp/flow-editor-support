(comment) @comment
(identifier) @variable

(directive
  "@" @keyword
  (directive_name) @keyword)
(directive_block
  "@" @keyword
  (directive_name) @keyword)

(parallel_block "parallel" @keyword.control)
(race_block "race" @keyword.control)
(match_block "match" @keyword.control)
(loop "loop" @keyword.control)
(loop "until" @keyword.control)

(atom (identifier) @function)
(projection_field (identifier) @property)
(modifier ":" @punctuation.delimiter)
(modifier (modifier_name) @property)
(modifier (modifier_value) @string)
(prompt "@" @punctuation.special)
(prompt) @string.special
(targets "#" @punctuation.special)
(targets (identifier) @label)
(excludes "~" @punctuation.special)
(excludes (identifier) @label)

(argument_block "@" @punctuation.special)
(projection "{" @punctuation.bracket)
(projection "}" @punctuation.bracket)
(array "[" @punctuation.bracket)
(array "]" @punctuation.bracket)
(group "(" @punctuation.bracket)
(group ")" @punctuation.bracket)
(loop "(" @punctuation.bracket)
(loop ")" @punctuation.bracket)

"->" @operator
"|" @operator
"||" @operator
"&&" @operator
"&" @operator
"?" @operator
"==" @operator
"!=" @operator
">=" @operator
"<=" @operator
(operator) @operator

(template_render "template.render" @function)
(template_render_argument_block "@" @punctuation.special)
(template_render_projection "{" @punctuation.bracket)
(template_render_projection "}" @punctuation.bracket)
(template_render_template_field
  "template" @property
  (template_string) @string)
(template_double_text) @string
(template_single_text) @string
(template_backtick_text) @string
(template_brace) @string
(template_escape) @string.escape
(template_action_open) @punctuation.special
(template_action_close) @punctuation.special
(template_trim_marker) @operator
(template_keyword) @keyword.control
(template_variable) @variable.member
(template_dot) @variable.builtin
(template_identifier) @function
(template_inner_string) @string
(template_operator) @operator
(template_action_content) @variable

(string) @string
(number) @number
((identifier) @constant.builtin
  (#match? @constant.builtin "^(true|false|null)$"))
