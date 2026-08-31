#!/usr/bin/env bash
# The admin account is key-only with no password, so plain `sudo` would prompt for
# a password that does not exist. Grant NOPASSWD, the usual cloud-admin setup.
# (Set a password later with `passwd "$ADMIN_USER"` and delete this file if preferred.)
set -euo pipefail
ADMIN_USER=${ADMIN_USER:?set ADMIN_USER to the interactive admin account}
cat > "/etc/sudoers.d/$ADMIN_USER" <<SUDO
$ADMIN_USER ALL=(ALL) NOPASSWD:ALL
SUDO
chmod 440 "/etc/sudoers.d/$ADMIN_USER"
visudo -cf "/etc/sudoers.d/$ADMIN_USER"
