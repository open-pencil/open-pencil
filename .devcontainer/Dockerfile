FROM oven/bun@sha256:1d22548f177f4ff38e0c15baa3c2c46c6c2060ba2d1bc573bb4720b407548f1d

# Bun 1.4.4, the packageManager version CI installs, pinned to the multi-platform image digest.

ARG CA_CERTIFICATES_VERSION=20250419
ARG GIT_VERSION=1:2.47.3-0+deb13u1
ARG GIT_LFS_VERSION=3.6.1-1+deb13u1
ARG OPENSSH_CLIENT_VERSION=1:10.0p1-7+deb13u4

USER root

RUN apt-get update \
    && apt-get install --yes --no-install-recommends \
        ca-certificates=${CA_CERTIFICATES_VERSION} \
        git=${GIT_VERSION} \
        git-lfs=${GIT_LFS_VERSION} \
        openssh-client=${OPENSSH_CLIENT_VERSION} \
    && rm -rf /var/lib/apt/lists/* \
    && git lfs install --system \
    && install -d -o bun -g bun \
        /workspace/open-pencil/node_modules \
        /workspace/open-pencil/packages/scene-graph/node_modules \
        /workspace/open-pencil/packages/pen/node_modules \
        /workspace/open-pencil/packages/collab/node_modules \
        /workspace/open-pencil/packages/kiwi/node_modules \
        /workspace/open-pencil/packages/fig/node_modules \
        /workspace/open-pencil/packages/core/node_modules \
        /workspace/open-pencil/packages/dom-css/node_modules \
        /workspace/open-pencil/packages/design-jsx/node_modules \
        /workspace/open-pencil/packages/emit/node_modules \
        /workspace/open-pencil/packages/vue/node_modules \
        /workspace/open-pencil/packages/cli/node_modules \
        /workspace/open-pencil/packages/mcp/node_modules \
        /workspace/open-pencil/packages/docs/node_modules \
        /workspace/open-pencil/tools/docs/node_modules

USER bun
