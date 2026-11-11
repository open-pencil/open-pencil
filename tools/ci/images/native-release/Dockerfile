# syntax=docker/dockerfile:1
# The Linux desktop release build's environment (build.yml): Ubuntu 22.04, whose glibc the .deb,
# .rpm, and AppImage then run on, with the libraries the Tauri app links and the AppImage bundles,
# and the pinned Rust toolchain, so a release downloads none of them.
FROM ubuntu:22.04@sha256:076e7bf82319619f28dd0aa9c02ab34b055ad37100395b4f49a2ffba04fb5e11

ARG DEBIAN_FRONTEND=noninteractive
# The channel rust-toolchain.toml pins; bun run check:dockerfiles fails when they differ.
ARG RUST_TOOLCHAIN=1.98.1

# A CI image is pinned by its digest where it is used, and rebuilding it brings its packages'
# security updates, so its apt packages stay unpinned.
# hadolint ignore=DL3008
RUN apt-get update \
    && apt-get install --yes --no-install-recommends \
        build-essential \
        ca-certificates \
        curl \
        file \
        git \
        libappindicator3-dev \
        libdbus-1-dev \
        librsvg2-dev \
        libwebkit2gtk-4.1-dev \
        patchelf \
        pkg-config \
        unzip \
        xdg-utils \
        xz-utils \
        zstd \
    && rm -rf /var/lib/apt/lists/*

# The rustup install below pipes the installer into sh; pipefail fails the build if curl does.
SHELL ["/bin/bash", "-o", "pipefail", "-c"]

ENV RUSTUP_HOME=/usr/local/rustup \
    CARGO_HOME=/usr/local/cargo \
    PATH=/usr/local/cargo/bin:$PATH

# The toolchain with the components and targets rust-toolchain.toml lists, so rustup finds it whole.
RUN curl --proto '=https' --tlsv1.2 --fail --silent --show-error https://sh.rustup.rs \
        | sh -s -- -y --no-modify-path --profile minimal --default-toolchain ${RUST_TOOLCHAIN} \
            --component clippy,rustfmt --target wasm32-unknown-unknown \
    && rustup --version \
    && cargo --version

# linuxdeploy, which bundles the AppImage, is itself an AppImage, and containers have no FUSE.
ENV APPIMAGE_EXTRACT_AND_RUN=1
