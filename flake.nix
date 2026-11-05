{
  description = "OpenPencil development environment for NixOS (Pure Wayland)";

  inputs = {
    nixpkgs.url = "github:NixOS/nixpkgs/nixos-unstable";
    flake-utils.url = "github:numtide/flake-utils";
  };

  outputs = { self, nixpkgs, flake-utils }:
    flake-utils.lib.eachDefaultSystem (system:
      let
        pkgs = import nixpkgs { inherit system; };

        nativeBuildInputs = with pkgs; [
          pkg-config
          rustc
          cargo
          rust-analyzer
          clippy
          bun
          nodejs_22
        ];

        buildInputs = with pkgs; [
          openssl
          glib
          gtk3
          cairo
          pango
          atk
          gdk-pixbuf
          libsoup_3
          webkitgtk_4_1
          libxkbcommon
          wayland
          wayland-protocols
          gsettings-desktop-schemas
        ];
      in
      {
        devShells.default = pkgs.mkShell {
          inherit nativeBuildInputs buildInputs;

          shellHook = ''
            export GDK_BACKEND="wayland"
            export WINIT_UNIX_BACKEND="wayland"
            export LD_LIBRARY_PATH="${pkgs.lib.makeLibraryPath buildInputs}:$LD_LIBRARY_PATH"
            export XDG_DATA_DIRS="${pkgs.gsettings-desktop-schemas}/share/gsettings-schemas/${pkgs.gsettings-desktop-schemas.name}:${pkgs.gtk3}/share/gsettings-schemas/${pkgs.gtk3.name}:$XDG_DATA_DIRS"
          '';
        };
      });
}
