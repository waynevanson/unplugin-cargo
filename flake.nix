{
  inputs = {
    nixpkgs.url = "github:nixos/nixpkgs/nixpkgs-unstable";
    fenix = {
      url = "github:nix-community/fenix";
      inputs.nixpkgs.follows = "nixpkgs";
    };
    flake-utils.url = "github:numtide/flake-utils";
  };

  outputs =
    {
      fenix,
      flake-utils,
      nixpkgs,
      self,
    }:
    flake-utils.lib.eachDefaultSystem (
      system:
      let
        pkgs = import nixpkgs { inherit system; };

        toolchains = with fenix.packages.${system}; rec {
          system = stable.completeToolchain;
          wasm = targets.wasm32-unknown-unknown.stable.rust-std;
          combined = combine [
            system
            wasm
          ];
        };

        rustPlatform = pkgs.makeRustPlatform {
          cargo = toolchains.system;
          rustc = toolchains.system;
        };

        rustPackages = with pkgs; [
          toolchains.combined
          wasm-pack
          llvmPackages.bintools
          wasm-bindgen-cli
          cargo-watch
        ];

        nodePackages = with pkgs; [
          nodejs_24
          corepack_24
          biome
          bun
          playwright-driver.browsers
        ];
      in
      {
        devShells.default = pkgs.mkShell {
          inherit system;
          packages = nodePackages ++ rustPackages;

          CARGO_TARGET_WASM32_UNKNOWN_UNKNOWN_LINKER = "lld";
          PLAYWRIGHT_BROWSERS_PATH = "${pkgs.playwright-driver.browsers}";
          PLAYWRIGHT_SKIP_VALIDATE_HOST_REQUIREMENTS = "true";
        };
      }
    );
}
