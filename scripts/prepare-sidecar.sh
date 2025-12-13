#!/bin/bash
set -e

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PROJECT_DIR="$(dirname "$SCRIPT_DIR")"
SIDECAR_DIR="$PROJECT_DIR/sidecar"
VENV_DIR="$SIDECAR_DIR/.venv"

echo "=== Preparing sidecar for packaging ==="
echo "Project directory: $PROJECT_DIR"
echo "Sidecar directory: $SIDECAR_DIR"

# Find Python 3.11+
find_python() {
    for py in python3.13 python3.12 python3.11 python3; do
        if command -v "$py" &> /dev/null; then
            version=$("$py" -c "import sys; print(f'{sys.version_info.major}.{sys.version_info.minor}')")
            major=$(echo "$version" | cut -d. -f1)
            minor=$(echo "$version" | cut -d. -f2)
            if [ "$major" -eq 3 ] && [ "$minor" -ge 11 ]; then
                echo "$py"
                return 0
            fi
        fi
    done
    return 1
}

PYTHON=$(find_python)
if [ -z "$PYTHON" ]; then
    echo "ERROR: Python 3.11 or higher is required"
    exit 1
fi

echo "Using Python: $PYTHON ($($PYTHON --version))"

# Remove existing venv if requested or if it doesn't exist
if [ "$1" == "--clean" ] || [ ! -d "$VENV_DIR" ]; then
    echo "Creating fresh virtual environment..."
    rm -rf "$VENV_DIR"
    "$PYTHON" -m venv "$VENV_DIR"
else
    echo "Using existing virtual environment"
fi

# Activate and install dependencies
echo "Installing dependencies..."
"$VENV_DIR/bin/pip" install --upgrade pip
"$VENV_DIR/bin/pip" install -r "$SIDECAR_DIR/requirements.txt"

# Clean up cache files to reduce size
echo "Cleaning up cache files..."
find "$VENV_DIR" -type d -name "__pycache__" -exec rm -rf {} + 2>/dev/null || true
find "$VENV_DIR" -type f -name "*.pyc" -delete 2>/dev/null || true
find "$VENV_DIR" -type f -name "*.pyo" -delete 2>/dev/null || true

# Ensure Python binary is executable
chmod +x "$VENV_DIR/bin/python"
chmod +x "$VENV_DIR/bin/python3"

# Show size
VENV_SIZE=$(du -sh "$VENV_DIR" | cut -f1)
echo ""
echo "=== Sidecar preparation complete ==="
echo "Virtual environment size: $VENV_SIZE"
echo "Location: $VENV_DIR"
