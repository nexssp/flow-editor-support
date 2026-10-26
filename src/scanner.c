#include "tree_sitter/parser.h"

#include <stdbool.h>
#include <stdint.h>
#include <string.h>

enum TokenType {
  RUST_LANGUAGE_BLOCK_CONTENT,
  LANGUAGE_BLOCK_CONTENT,
  LANGUAGE_INLINE_DOUBLE_CONTENT,
  LANGUAGE_INLINE_SINGLE_CONTENT,
  LANGUAGE_INLINE_BACKTICK_CONTENT,
};

void *tree_sitter_flow_external_scanner_create(void) { return NULL; }

void tree_sitter_flow_external_scanner_destroy(void *payload) { (void)payload; }

unsigned tree_sitter_flow_external_scanner_serialize(void *payload, char *buffer) {
  (void)payload;
  (void)buffer;
  return 0;
}

void tree_sitter_flow_external_scanner_deserialize(void *payload, const char *buffer, unsigned length) {
  (void)payload;
  (void)buffer;
  (void)length;
}

static void advance(TSLexer *lexer) { lexer->advance(lexer, false); }

static bool identifier_start(uint32_t character) {
  return (character >= 'a' && character <= 'z') ||
         (character >= 'A' && character <= 'Z') || character == '_';
}

static bool identifier_continue(uint32_t character) {
  return identifier_start(character) || (character >= '0' && character <= '9');
}

enum SingleQuotePrefix { NOT_A_LIFETIME, QUOTED_TOKEN_COMPLETE, LIFETIME_TOKEN };

static enum SingleQuotePrefix scan_lifetime_prefix(TSLexer *lexer) {
  if (!identifier_start(lexer->lookahead)) return NOT_A_LIFETIME;

  char name[64];
  size_t name_length = 0;
  while (identifier_continue(lexer->lookahead)) {
    if (name_length + 1 < sizeof(name)) name[name_length] = (char)lexer->lookahead;
    name_length++;
    advance(lexer);
  }
  size_t stored_length = name_length < sizeof(name) - 1 ? name_length : sizeof(name) - 1;
  name[stored_length] = '\0';

  if (lexer->lookahead == '\'') {
    advance(lexer);
    return QUOTED_TOKEN_COMPLETE;
  }

  bool static_lifetime = strcmp(name, "static") == 0;
  if (lexer->lookahead == '>' || lexer->lookahead == ',' ||
      lexer->lookahead == ')' || lexer->lookahead == ':' ||
      lexer->lookahead == '&') {
    return static_lifetime || name_length == 1 || lexer->lookahead == '>'
      ? LIFETIME_TOKEN : NOT_A_LIFETIME;
  }

  if (static_lifetime || name_length > 0) {
    while (lexer->lookahead == ' ' || lexer->lookahead == '\t') advance(lexer);
    char next_word[32];
    size_t next_length = 0;
    while (identifier_continue(lexer->lookahead)) {
      if (next_length + 1 < sizeof(next_word)) next_word[next_length] = (char)lexer->lookahead;
      next_length++;
      advance(lexer);
    }
    size_t next_stored_length = next_length < sizeof(next_word) - 1 ? next_length : sizeof(next_word) - 1;
    next_word[next_stored_length] = '\0';
    if (strcmp(next_word, "str") == 0 || strcmp(next_word, "mut") == 0 ||
        (next_length > 0 && next_word[0] >= 'A' && next_word[0] <= 'Z')) {
      return LIFETIME_TOKEN;
    }
  }
  return NOT_A_LIFETIME;
}

static bool scan_quoted(TSLexer *lexer, uint32_t quote, bool *consumed, bool rust_language) {
  bool triple = false;
  advance(lexer);
  *consumed = true;

  if (lexer->lookahead == quote) {
    advance(lexer);
    if (lexer->lookahead == quote) {
      advance(lexer);
      triple = true;
    } else {
      // Two adjacent quotes form an empty ordinary string.
      return true;
    }
  }

  // Rust lifetimes ('a, 'static, and 'a str) are apostrophe-prefixed identifiers,
  // not strings. If the prefix is a real single-quoted token, scanning continues
  // from its closing quote; otherwise ordinary string scanning resumes in place.
  if (rust_language && !triple && quote == '\'') {
    enum SingleQuotePrefix prefix = scan_lifetime_prefix(lexer);
    if (prefix != NOT_A_LIFETIME) return true;
  }

  while (!lexer->eof(lexer)) {
    uint32_t character = lexer->lookahead;
    if (character == '\\') {
      advance(lexer);
      if (!lexer->eof(lexer)) advance(lexer);
      continue;
    }
    if (character == quote) {
      advance(lexer);
      if (!triple) return true;
      if (lexer->lookahead == quote) {
        advance(lexer);
        if (lexer->lookahead == quote) {
          advance(lexer);
          return true;
        }
      }
      continue;
    }
    advance(lexer);
  }
  return false;
}

static bool scan_inline_content(TSLexer *lexer, uint32_t delimiter, enum TokenType token) {
  bool consumed = false;
  while (!lexer->eof(lexer)) {
    uint32_t character = lexer->lookahead;
    if (character == delimiter) {
      if (!consumed) return false;
      lexer->mark_end(lexer);
      lexer->result_symbol = token;
      return true;
    }
    if (character == '\\') {
      advance(lexer);
      consumed = true;
      if (!lexer->eof(lexer)) advance(lexer);
      continue;
    }
    advance(lexer);
    consumed = true;
  }

  if (!consumed) return false;
  lexer->mark_end(lexer);
  lexer->result_symbol = token;
  return true;
}

static bool scan_rust_raw_string(TSLexer *lexer, bool *consumed) {
  uint32_t hashes = 0;
  advance(lexer);  // r
  *consumed = true;
  while (lexer->lookahead == '#' && hashes < 32) {
    advance(lexer);
    hashes++;
  }
  if (lexer->lookahead != '"') return false;
  advance(lexer);
  while (!lexer->eof(lexer)) {
    if (lexer->lookahead != '"') {
      advance(lexer);
      continue;
    }
    advance(lexer);
    uint32_t matched_hashes = 0;
    while (matched_hashes < hashes && lexer->lookahead == '#') {
      advance(lexer);
      matched_hashes++;
    }
    if (matched_hashes == hashes) return true;
  }
  return false;
}

static bool scan_block_content(TSLexer *lexer, bool rust_language) {
  enum TokenType token = rust_language ? RUST_LANGUAGE_BLOCK_CONTENT : LANGUAGE_BLOCK_CONTENT;
  uint32_t brace_depth = 0;
  bool consumed = false;
  bool comment = false;
  bool block_comment = false;

  while (!lexer->eof(lexer)) {
    uint32_t character = lexer->lookahead;

    if (block_comment) {
      advance(lexer);
      consumed = true;
      if (character == '*' && lexer->lookahead == '/') {
        advance(lexer);
        block_comment = false;
      }
      continue;
    }

    if (comment) {
      advance(lexer);
      consumed = true;
      if (character == '\n') comment = false;
      continue;
    }

    if (character == '#') {
      advance(lexer);
      consumed = true;
      if (lexer->lookahead != '[') comment = true;
      continue;
    }

    if (character == 'r') {
      scan_rust_raw_string(lexer, &consumed);
      continue;
    }

    if (character == '/') {
      advance(lexer);
      consumed = true;
      if (lexer->lookahead == '/') {
        advance(lexer);
        comment = true;
      } else if (lexer->lookahead == '*') {
        advance(lexer);
        block_comment = true;
      }
      continue;
    }

    if (character == '\'' || character == '"' || character == '`') {
      if (!scan_quoted(lexer, character, &consumed, rust_language)) break;
      continue;
    }

    if (character == '{') {
      brace_depth++;
      advance(lexer);
      consumed = true;
      continue;
    }

    if (character == '}') {
      if (brace_depth == 0) {
        if (!consumed) return false;
        lexer->mark_end(lexer);
        lexer->result_symbol = token;
        return true;
      }
      brace_depth--;
      advance(lexer);
      consumed = true;
      continue;
    }

    advance(lexer);
    consumed = true;
  }

  if (!consumed) return false;
  lexer->mark_end(lexer);
  lexer->result_symbol = token;
  return true;
}

bool tree_sitter_flow_external_scanner_scan(void *payload, TSLexer *lexer, const bool *valid_symbols) {
  (void)payload;
  if (valid_symbols[RUST_LANGUAGE_BLOCK_CONTENT]) return scan_block_content(lexer, true);
  if (valid_symbols[LANGUAGE_BLOCK_CONTENT]) return scan_block_content(lexer, false);
  if (valid_symbols[LANGUAGE_INLINE_DOUBLE_CONTENT]) {
    return scan_inline_content(lexer, '"', LANGUAGE_INLINE_DOUBLE_CONTENT);
  }
  if (valid_symbols[LANGUAGE_INLINE_SINGLE_CONTENT]) {
    return scan_inline_content(lexer, '\'', LANGUAGE_INLINE_SINGLE_CONTENT);
  }
  if (valid_symbols[LANGUAGE_INLINE_BACKTICK_CONTENT]) {
    return scan_inline_content(lexer, '`', LANGUAGE_INLINE_BACKTICK_CONTENT);
  }
  return false;
}
