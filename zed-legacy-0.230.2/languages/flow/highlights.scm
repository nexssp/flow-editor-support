(comment) @comment
(identifier) @variable

(directive
  "@" @keyword
  (directive_name) @keyword)

(loop "loop" @keyword.control)

(atom (identifier) @function)
(modifier ":" @punctuation.delimiter)
(modifier (modifier_name) @property)
(modifier (modifier_value) @string)
(prompt "@" @punctuation.special)
(prompt) @string.special
(targets "#" @punctuation.special)
(targets (identifier) @label)
(excludes "~" @punctuation.special)
(excludes (identifier) @label)

(projection "{" @punctuation.bracket)
(projection "}" @punctuation.bracket)
(group "(" @punctuation.bracket)
(group ")" @punctuation.bracket)
(loop "(" @punctuation.bracket)
(loop ")" @punctuation.bracket)
(loop "until" @keyword.control)

"->" @operator
"|" @operator
"||" @operator
"&" @operator
"?" @operator

(string) @string
(number) @number
(operator) @operator
