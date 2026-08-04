#!/bin/bash
set -e

echo "=== FYI Studio — Hermes Agent Setup ==="

# 1. Install Hermes Agent
echo ">>> Installing Hermes Agent..."
pip install --user --upgrade pip
pip install --user hermes-agent

# 2. Verify installation
echo ">>> Verifying installation..."
hermes --version 2>/dev/null || {
  echo "WARNING: hermes not in PATH yet, trying pipx..."
  pip install --user pipx
  pipx install hermes-agent
}

# 3. Create Hermes config directory
mkdir -p ~/.hermes

# 4. Copy project skills to Hermes
if [ -d .hermes/skills ]; then
  mkdir -p ~/.hermes/skills
  cp -r .hermes/skills/* ~/.hermes/skills/ 2>/dev/null || true
  echo ">>> Project skills copied"
fi

# 5. Setup pnpm
echo ">>> Setting up pnpm..."
pnpm setup 2>/dev/null || true
export PNPM_HOME="$HOME/.local/share/pnpm"
export PATH="$PNPM_HOME:$PATH"

# 6. Install project dependencies (if package.json exists)
if [ -f package.json ]; then
  echo ">>> Installing project dependencies..."
  pnpm install --frozen-lockfile 2>/dev/null || pnpm install || echo "No deps to install yet"
fi

# 7. Verify Docker
echo ">>> Verifying Docker..."
docker --version 2>/dev/null && echo "Docker ready" || echo "Docker not available yet (may need restart)"

# 8. Print summary
echo ""
echo "=== Setup Complete ==="
echo ""
echo "Hermes: $(hermes --version 2>/dev/null || echo 'check PATH')"
echo "Node:   $(node --version)"
echo "pnpm:   $(pnpm --version 2>/dev/null || echo 'not found')"
echo "Python: $(python3 --version)"
echo "Docker: $(docker --version 2>/dev/null || echo 'not ready')"
echo ""
echo "Next step:"
echo "  1. Set your API key: hermes config set provider.api_key <your-key>"
echo "  2. Start working: hermes"
echo ""
echo "Or just run: hermes"
