FROM node:lts-trixie-slim AS base

LABEL org.opencontainers.image.title="theme-browser registry refresh runner"
LABEL org.opencontainers.image.description="Scheduled runner for the theme-browser monorepo registry pipeline"
LABEL org.opencontainers.image.source="https://github.com/raulcorreia7/theme-browser-monorepo"

RUN apt-get update \
  && apt-get install -y --no-install-recommends \
    bash \
    ca-certificates \
    curl \
    git \
    openssh-client \
    jq \
    ripgrep \
    build-essential \
    make \
    python3 \
    lua5.1 \
    neovim \
  && rm -rf /var/lib/apt/lists/*

RUN corepack enable

FROM base AS runner

WORKDIR /work

COPY scripts/registry-refresh.sh /usr/local/bin/theme-browser-registry-refresh

RUN chmod +x /usr/local/bin/theme-browser-registry-refresh

ENTRYPOINT ["/usr/local/bin/theme-browser-registry-refresh"]
