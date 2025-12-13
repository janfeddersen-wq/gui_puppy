#!/bin/bash

# GUI Puppy Setup Script
# This script installs all dependencies needed to run gui_puppy

set -e

echo "=== GUI Puppy Setup ==="
echo ""

# Check for Node.js
if ! command -v node &> /dev/null; then
    echo "Error: Node.js is not installed. Please install Node.js (v18+) first."
    echo "Visit: https://nodejs.org/"
    exit 1
fi

echo "Node.js version: $(node --version)"

# Check for npm
if ! command -v npm &> /dev/null; then
    echo "Error: npm is not installed."
    exit 1
fi

echo "npm version: $(npm --version)"

# Check for Python
if ! command -v python3 &> /dev/null; then
    echo "Error: Python 3 is not installed. Please install Python 3.10+ first."
    exit 1
fi

echo "Python version: $(python3 --version)"

echo ""
echo "=== Installing Node.js dependencies ==="
npm install

echo ""
echo "=== Setting up Python virtual environment ==="
cd sidecar

if [ ! -d ".venv" ]; then
    python3 -m venv .venv
    echo "Created virtual environment"
fi

echo "Activating virtual environment..."
source .venv/bin/activate

echo "Installing Python dependencies..."
pip install -r requirements.txt

deactivate
cd ..

echo ""
echo "=== Setup Complete ==="
echo ""
echo "To run the application:"
echo "  1. Start the sidecar: cd sidecar && source .venv/bin/activate && python gui_sidecar.py"
echo "  2. In another terminal, start the GUI: npm run dev"
