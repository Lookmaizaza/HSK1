{ pkgs, ... }: {
  channel = "stable-24.05";

  packages = [
    pkgs.nodejs_22
    pkgs.pnpm
  ];

  env = {};

  idx = {
    extensions = [
      "svelte.svelte-vscode"
      "bradlc.vscode-tailwindcss"
    ];

    workspace = {
      onCreate = {
        setup-env = "test -f .env || cp .env.example .env";
        install-deps = "pnpm install --frozen-lockfile || pnpm install";
      };
      onStart = {};
    };

    previews = {
      enable = true;
      previews = {
        web = {
          command = [ "pnpm" "dev" "--port" "$PORT" "--host" "0.0.0.0" ];
          manager = "web";
        };
      };
    };
  };
}

