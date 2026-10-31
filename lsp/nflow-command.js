'use strict';

function nflowExecutable(env = process.env) {
  // NFLOW_BIN is canonical; both FLOW_NFLOW_* names remain legacy fallbacks.
  return [
    env.NFLOW_BIN,
    env.FLOW_NFLOW_LSP_BIN,
    env.FLOW_NFLOW_BIN,
    'nflow',
  ].find(value => typeof value === 'string' && value.trim())?.trim();
}

module.exports = { nflowExecutable };
