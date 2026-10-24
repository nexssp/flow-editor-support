use std::env;
use zed_extension_api::{self as zed, LanguageServerId, Result, Worktree};

struct FlowExtension;

impl zed::Extension for FlowExtension {
    fn new() -> Self {
        Self
    }

    fn language_server_command(
        &mut self,
        _language_server_id: &LanguageServerId,
        worktree: &Worktree,
    ) -> Result<zed::Command> {
        let extension_dir = env::current_dir()
            .map_err(|error| format!("unable to locate Nexss Flow extension directory: {error}"))?;
        let server_path = extension_dir.join("lsp").join("flow-language-server.js");
        if !server_path.is_file() {
            return Err(format!("Nexss Flow language server not found: {}", server_path.display()));
        }
        let node_path = zed::node_binary_path()?;

        Ok(zed::Command {
            command: node_path,
            args: vec![server_path.to_string_lossy().into_owned()],
            env: worktree.shell_env(),
        })
    }
}

zed::register_extension!(FlowExtension);
