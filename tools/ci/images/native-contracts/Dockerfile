# syntax=docker/dockerfile:1
# The Native app contracts job's environment (ci.yml): Ubuntu 24.04 with the WebKitGTK libraries the
# Tauri app compiles against. The job installs Rust with rustup, from rust-toolchain.toml.
FROM ubuntu:24.04@sha256:561618e2c15bf2397621dd04f96926663a3b5616c189cf7e38db7e82f5c538ea

ARG DEBIAN_FRONTEND=noninteractive

# A CI image is pinned by its digest where it is used, and rebuilding it brings its packages'
# security updates, so its apt packages stay unpinned.
# hadolint ignore=DL3008
RUN apt-get update \
    && apt-get install --yes --no-install-recommends \
        ca-certificates \
        curl \
        git \
        libappindicator3-dev \
        librsvg2-dev \
        libwebkit2gtk-4.1-dev \
        pkg-config \
        unzip \
        xz-utils \
    && rm -rf /var/lib/apt/lists/*
