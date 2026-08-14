FROM oven/bun@sha256:b86c67b531d87b4db11470d9b2bd0c519b1976eee6fcd71634e73abfa6230d2e

# Bun 1.3.10, pinned to the multi-platform image digest.

ARG CA_CERTIFICATES_VERSION=20250419
ARG GIT_VERSION=1:2.47.3-0+deb13u1
ARG GIT_LFS_VERSION=3.6.1-1+deb13u1
ARG OPENSSH_CLIENT_VERSION=1:10.0p1-7+deb13u4
ARG SUDO_VERSION=1.9.16p2-3+deb13u2

USER root

RUN apt-get update \
    && apt-get install --yes --no-install-recommends \
        ca-certificates=${CA_CERTIFICATES_VERSION} \
        git=${GIT_VERSION} \
        git-lfs=${GIT_LFS_VERSION} \
        openssh-client=${OPENSSH_CLIENT_VERSION} \
        sudo=${SUDO_VERSION} \
    && rm -rf /var/lib/apt/lists/* \
    && git lfs install --system

COPY setup-dependencies /usr/local/bin/open-pencil-setup-dependencies

RUN chown root:root /usr/local/bin/open-pencil-setup-dependencies \
    && chmod 0755 /usr/local/bin/open-pencil-setup-dependencies \
    && printf '%s\n' \
        'bun ALL=(root) NOPASSWD: /usr/local/bin/open-pencil-setup-dependencies' \
        > /etc/sudoers.d/bun \
    && chmod 0440 /etc/sudoers.d/bun

USER bun
