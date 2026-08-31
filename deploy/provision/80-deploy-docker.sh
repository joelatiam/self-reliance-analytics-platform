#!/usr/bin/env bash
# The deploy account needs the docker socket to run compose.
#
# This makes `deploy` effectively root: docker group membership allows
# `docker run -v /:/host`. That is worth stating plainly rather than pretending
# otherwise — but it grants no new exposure, because anyone who can merge to
# main already executes arbitrary code here through deploy.sh. Protect main.
set -euo pipefail
usermod -aG docker deploy
id deploy
