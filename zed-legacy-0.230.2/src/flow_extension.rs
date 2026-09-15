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
        let node_path = zed::node_binary_path()?;

        Ok(zed::Command {
            command: node_path,
            args: vec!["lsp/flow-language-server.js".to_string()],
            env: worktree.shell_env(),
        })
    }
}

zed::register_extension!(FlowExtension);
