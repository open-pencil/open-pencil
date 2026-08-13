FROM oven/bun:1.3.10@sha256:b86c67b531d87b4db11470d9b2bd0c519b1976eee6fcd71634e73abfa6230d2e

USER root

RUN apt-get update \
    && apt-get install --yes --no-install-recommends \
        ca-certificates \
        git \
        git-lfs \
        openssh-client \
        sudo \
    && rm -rf /var/lib/apt/lists/* \
    && echo "bun ALL=(root) NOPASSWD:ALL" > /etc/sudoers.d/bun \
    && chmod 0440 /etc/sudoers.d/bun \
    && git lfs install --system

USER bun
