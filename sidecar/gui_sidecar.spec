# -*- mode: python ; coding: utf-8 -*-
# PyInstaller spec file for gui_sidecar

import sys
from PyInstaller.utils.hooks import collect_all, collect_submodules

block_cipher = None

# Collect all pydantic and pydantic_ai modules
hiddenimports = []
hiddenimports += collect_submodules('pydantic')
hiddenimports += collect_submodules('pydantic_core')
hiddenimports += collect_submodules('pydantic_ai')
hiddenimports += collect_submodules('code_puppy')
hiddenimports += collect_submodules('socketio')
hiddenimports += collect_submodules('aiohttp')
hiddenimports += collect_submodules('engineio')

# Add specific imports that might be missed
hiddenimports += [
    'pydantic.deprecated.decorator',
    'pydantic._internal._config',
    'pydantic._internal._generate_schema',
    'pydantic._internal._validators',
    'pydantic.functional_validators',
    'pydantic.type_adapter',
    'typing_extensions',
    'annotated_types',
]

# Collect data files
datas = []

# Collect pydantic data
pydantic_datas, pydantic_binaries, pydantic_hiddenimports = collect_all('pydantic')
datas += pydantic_datas
hiddenimports += pydantic_hiddenimports

# Collect pydantic_core data
pydantic_core_datas, pydantic_core_binaries, pydantic_core_hiddenimports = collect_all('pydantic_core')
datas += pydantic_core_datas
hiddenimports += pydantic_core_hiddenimports

# Collect code_puppy data (including models.json, plugins, etc.)
code_puppy_datas, code_puppy_binaries, code_puppy_hiddenimports = collect_all('code_puppy')
datas += code_puppy_datas
hiddenimports += code_puppy_hiddenimports

a = Analysis(
    ['gui_sidecar.py'],
    pathex=[],
    binaries=[],
    datas=datas,
    hiddenimports=hiddenimports,
    hookspath=[],
    hooksconfig={},
    runtime_hooks=[],
    excludes=[
        'logfire',  # Exclude logfire to avoid source inspection issues
        'tkinter',
        'matplotlib',
        'PIL',
        'numpy',
    ],
    win_no_prefer_redirects=False,
    win_private_assemblies=False,
    cipher=block_cipher,
    noarchive=False,
)

pyz = PYZ(a.pure, a.zipped_data, cipher=block_cipher)

exe = EXE(
    pyz,
    a.scripts,
    a.binaries,
    a.zipfiles,
    a.datas,
    [],
    name='gui_sidecar',
    debug=False,
    bootloader_ignore_signals=False,
    strip=False,
    upx=True,
    upx_exclude=[],
    runtime_tmpdir=None,
    console=True,
    disable_windowed_traceback=False,
    argv_emulation=False,
    target_arch=None,
    codesign_identity=None,
    entitlements_file=None,
)
