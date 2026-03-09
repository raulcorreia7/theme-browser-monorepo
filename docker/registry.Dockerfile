FROM node:lts-trixie-slim

LABEL org.opencontainers.image.title="theme-browser registry refresh runner"
LABEL org.opencontainers.image.description="Scheduled runner for the theme-browser monorepo registry pipeline"
LABEL org.opencontainers.image.source="https://github.com/raulcorreia7/theme-browser-monorepo"

RUN apt-get update \
  && apt-get install -y --no-install-recommends \
    bash \
    ca-certificates \
    curl \
    git \
    jq \
    lua5.1 \
    make \
    neovim \
    openssh-client \
    python3 \
    ripgrep \
    g++ \
  && rm -rf /var/lib/apt/lists/*

RUN corepack enable

WORKDIR /work

COPY scripts/registry-refresh.sh /usr/local/bin/theme-browser-registry-refresh

RUN chmod +x /usr/local/bin/theme-browser-registry-refresh

ENTRYPOINT ["/usr/local/bin/theme-browser-registry-refresh"]
