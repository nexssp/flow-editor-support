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

(string) @string
(number) @number
((identifier) @constant.builtin
  (#match? @constant.builtin "^(true|false|null)$"))
