(comment) @comment
(hash_comment) @comment
(identifier) @variable
(pipeline_header
  "@" @keyword.control
  "pipeline" @keyword.control
  (pipeline_name) @function)
(pipeline_input_name) @variable.parameter
(pipeline_type) @type
(pipeline_output_type) @type
(schema_declaration
  "@" @keyword.control
  "schema" @keyword.control
  (schema_name) @type)
(schema_field
  (schema_field_name) @property
  (schema_field_type) @type)
((schema_field_name) @property.builtin
  (#match? @property.builtin "^(xerr|on_error|input|result)$"))
(schema_tag_key
  (schema_tag_key_name) @attribute
  ":" @punctuation.delimiter)
(schema_tag_value) @string
(qualified_identifier
  (identifier) @namespace
  "." @punctuation.delimiter
  (identifier) @function)
(path_reference) @variable.member
(input_rooted_spread) @operator
(spread_operator) @operator
(named_binding "as" @keyword.control)
(path_shorthand_field (path_reference) @property)

(function_declaration
  "@" @punctuation.special
  "func" @keyword.control
  (function_name) @function)
(function_call (function_call_name) @function)
(binding_keyword) @keyword.control
(function_parameter
  (identifier) @variable.parameter
  (function_type) @type)
(function_declaration
  (function_type) @type)
(function_body "{" @punctuation.bracket)
(function_body "}" @punctuation.bracket)

(directive
  "@" @keyword.control
  (directive_name) @keyword.control)
(directive_block
  "@" @keyword.control
  (directive_name) @keyword.control)

(parallel_block "parallel" @keyword.control)
(race_block "race" @keyword.control)
(match_block "match" @keyword.control)
(if_block "if" @keyword.control)
(if_block "else" @keyword.control)
(each_block "each" @keyword.control)
(loop "loop" @keyword.control)
(loop "until" @keyword.control)

(language_block "py" @keyword.control)
(language_inline "py" @keyword.control)
(language_block "py"
  (language_block_content) @injection.content
  (#set! injection.language "python"))
(language_inline "py"
  (language_inline_double_content) @injection.content
  (#set! injection.language "python"))
(language_inline "py"
  (language_inline_single_content) @injection.content
  (#set! injection.language "python"))
(language_inline "py"
  (language_inline_backtick_content) @injection.content
  (#set! injection.language "python"))
(language_block "python" @keyword.control)
(language_inline "python" @keyword.control)
(language_block "python"
  (language_block_content) @injection.content
  (#set! injection.language "python"))
(language_inline "python"
  (language_inline_double_content) @injection.content
  (#set! injection.language "python"))
(language_inline "python"
  (language_inline_single_content) @injection.content
  (#set! injection.language "python"))
(language_inline "python"
  (language_inline_backtick_content) @injection.content
  (#set! injection.language "python"))
(language_block "py2" @keyword.control)
(language_inline "py2" @keyword.control)
(language_block "py2"
  (language_block_content) @injection.content
  (#set! injection.language "python"))
(language_inline "py2"
  (language_inline_double_content) @injection.content
  (#set! injection.language "python"))
(language_inline "py2"
  (language_inline_single_content) @injection.content
  (#set! injection.language "python"))
(language_inline "py2"
  (language_inline_backtick_content) @injection.content
  (#set! injection.language "python"))
(language_block "python2" @keyword.control)
(language_inline "python2" @keyword.control)
(language_block "python2"
  (language_block_content) @injection.content
  (#set! injection.language "python"))
(language_inline "python2"
  (language_inline_double_content) @injection.content
  (#set! injection.language "python"))
(language_inline "python2"
  (language_inline_single_content) @injection.content
  (#set! injection.language "python"))
(language_inline "python2"
  (language_inline_backtick_content) @injection.content
  (#set! injection.language "python"))
(language_block "py3" @keyword.control)
(language_inline "py3" @keyword.control)
(language_block "py3"
  (language_block_content) @injection.content
  (#set! injection.language "python"))
(language_inline "py3"
  (language_inline_double_content) @injection.content
  (#set! injection.language "python"))
(language_inline "py3"
  (language_inline_single_content) @injection.content
  (#set! injection.language "python"))
(language_inline "py3"
  (language_inline_backtick_content) @injection.content
  (#set! injection.language "python"))
(language_block "python3" @keyword.control)
(language_inline "python3" @keyword.control)
(language_block "python3"
  (language_block_content) @injection.content
  (#set! injection.language "python"))
(language_inline "python3"
  (language_inline_double_content) @injection.content
  (#set! injection.language "python"))
(language_inline "python3"
  (language_inline_single_content) @injection.content
  (#set! injection.language "python"))
(language_inline "python3"
  (language_inline_backtick_content) @injection.content
  (#set! injection.language "python"))
(language_block "rust" @keyword.control)
(language_inline "rust" @keyword.control)
(language_block "rust"
  (rust_language_block_content) @injection.content
  (#set! injection.language "rust"))
(language_inline "rust"
  (language_inline_double_content) @injection.content
  (#set! injection.language "rust"))
(language_inline "rust"
  (language_inline_single_content) @injection.content
  (#set! injection.language "rust"))
(language_inline "rust"
  (language_inline_backtick_content) @injection.content
  (#set! injection.language "rust"))
(language_block "rs" @keyword.control)
(language_inline "rs" @keyword.control)
(language_block "rs"
  (rust_language_block_content) @injection.content
  (#set! injection.language "rust"))
(language_inline "rs"
  (language_inline_double_content) @injection.content
  (#set! injection.language "rust"))
(language_inline "rs"
  (language_inline_single_content) @injection.content
  (#set! injection.language "rust"))
(language_inline "rs"
  (language_inline_backtick_content) @injection.content
  (#set! injection.language "rust"))
(language_block "php" @keyword.control)
(language_inline "php" @keyword.control)
(language_block "php"
  (language_block_content) @injection.content
  (#set! injection.language "php"))
(language_inline "php"
  (language_inline_double_content) @injection.content
  (#set! injection.language "php"))
(language_inline "php"
  (language_inline_single_content) @injection.content
  (#set! injection.language "php"))
(language_inline "php"
  (language_inline_backtick_content) @injection.content
  (#set! injection.language "php"))
(language_block "typescript" @keyword.control)
(language_inline "typescript" @keyword.control)
(language_block "typescript"
  (language_block_content) @injection.content
  (#set! injection.language "typescript"))
(language_inline "typescript"
  (language_inline_double_content) @injection.content
  (#set! injection.language "typescript"))
(language_inline "typescript"
  (language_inline_single_content) @injection.content
  (#set! injection.language "typescript"))
(language_inline "typescript"
  (language_inline_backtick_content) @injection.content
  (#set! injection.language "typescript"))
(language_block "ts" @keyword.control)
(language_inline "ts" @keyword.control)
(language_block "ts"
  (language_block_content) @injection.content
  (#set! injection.language "typescript"))
(language_inline "ts"
  (language_inline_double_content) @injection.content
  (#set! injection.language "typescript"))
(language_inline "ts"
  (language_inline_single_content) @injection.content
  (#set! injection.language "typescript"))
(language_inline "ts"
  (language_inline_backtick_content) @injection.content
  (#set! injection.language "typescript"))
(language_block "javascript" @keyword.control)
(language_inline "javascript" @keyword.control)
(language_block "javascript"
  (language_block_content) @injection.content
  (#set! injection.language "javascript"))
(language_inline "javascript"
  (language_inline_double_content) @injection.content
  (#set! injection.language "javascript"))
(language_inline "javascript"
  (language_inline_single_content) @injection.content
  (#set! injection.language "javascript"))
(language_inline "javascript"
  (language_inline_backtick_content) @injection.content
  (#set! injection.language "javascript"))
(language_block "js" @keyword.control)
(language_inline "js" @keyword.control)
(language_block "js"
  (language_block_content) @injection.content
  (#set! injection.language "javascript"))
(language_inline "js"
  (language_inline_double_content) @injection.content
  (#set! injection.language "javascript"))
(language_inline "js"
  (language_inline_single_content) @injection.content
  (#set! injection.language "javascript"))
(language_inline "js"
  (language_inline_backtick_content) @injection.content
  (#set! injection.language "javascript"))
(language_block "golang" @keyword.control)
(language_inline "golang" @keyword.control)
(language_block "golang"
  (language_block_content) @injection.content
  (#set! injection.language "go"))
(language_inline "golang"
  (language_inline_double_content) @injection.content
  (#set! injection.language "go"))
(language_inline "golang"
  (language_inline_single_content) @injection.content
  (#set! injection.language "go"))
(language_inline "golang"
  (language_inline_backtick_content) @injection.content
  (#set! injection.language "go"))
(language_block "go" @keyword.control)
(language_inline "go" @keyword.control)
(language_block "go"
  (language_block_content) @injection.content
  (#set! injection.language "go"))
(language_inline "go"
  (language_inline_double_content) @injection.content
  (#set! injection.language "go"))
(language_inline "go"
  (language_inline_single_content) @injection.content
  (#set! injection.language "go"))
(language_inline "go"
  (language_inline_backtick_content) @injection.content
  (#set! injection.language "go"))
(projection_field (identifier_reference) @property)
(modifier ":" @punctuation.delimiter)
(modifier (modifier_name) @attribute)
(modifier (modifier_value) @string)
(prompt "@" @punctuation.special)
(prompt) @string.special
(targets "#" @punctuation.special)
(targets (identifier_reference) @label)
(excludes "~" @punctuation.special)
(excludes (identifier_reference) @label)

(argument_list "(" @punctuation.bracket)
(argument_list ")" @punctuation.bracket)
(projection "{" @punctuation.bracket)
(projection "}" @punctuation.bracket)
(array "[" @punctuation.bracket)
(array "]" @punctuation.bracket)
(group "(" @punctuation.bracket)
(group ")" @punctuation.bracket)
(loop "(" @punctuation.bracket)
(loop ")" @punctuation.bracket)

"->" @operator
"??" @operator
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
(template_render_arguments "(" @punctuation.bracket)
(template_render_arguments ")" @punctuation.bracket)
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
