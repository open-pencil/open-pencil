FROM ubuntu@sha256:561618e2c15bf2397621dd04f96926663a3b5616c189cf7e38db7e82f5c538ea

ARG DEBIAN_FRONTEND=noninteractive

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
