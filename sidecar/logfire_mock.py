"""
Mock logfire module to prevent issues with PyInstaller.
Logfire tries to inspect source code which doesn't exist in frozen executables.
"""

import sys
import os

# Disable logfire before any pydantic imports
os.environ['LOGFIRE_IGNORE_NO_CONFIG'] = '1'
os.environ['PYDANTIC_DISABLE_PLUGINS'] = '1'


class _MockLogfire:
    """Mock Logfire class that does nothing."""

    def __init__(self, *args, **kwargs):
        pass

    def __call__(self, *args, **kwargs):
        return self

    def __getattr__(self, name):
        return _MockLogfire()

    def configure(self, *args, **kwargs):
        pass

    def instrument_pydantic(self, *args, **kwargs):
        pass

    def span(self, *args, **kwargs):
        return self

    def __enter__(self):
        return self

    def __exit__(self, *args):
        pass


def install_mock():
    """Install the mock logfire module into sys.modules."""
    mock_module = type(sys)('logfire')
    mock_module.Logfire = _MockLogfire
    mock_module.LogfireSpan = _MockLogfire
    mock_module.configure = lambda *args, **kwargs: None
    mock_module.instrument_pydantic = lambda *args, **kwargs: None
    mock_module.span = lambda *args, **kwargs: _MockLogfire()
    mock_module.DEFAULT_LOGFIRE_INSTANCE = _MockLogfire()
    mock_module.suppress_instrumentation = lambda: _MockLogfire()
    mock_module.no_auto_trace = lambda f: f
    mock_module.instrument = lambda *args, **kwargs: lambda f: f
    mock_module.trace = lambda *args, **kwargs: lambda f: f
    mock_module.log = lambda *args, **kwargs: None
    mock_module.info = lambda *args, **kwargs: None
    mock_module.debug = lambda *args, **kwargs: None
    mock_module.warning = lambda *args, **kwargs: None
    mock_module.error = lambda *args, **kwargs: None
    mock_module.exception = lambda *args, **kwargs: None

    sys.modules['logfire'] = mock_module
    sys.modules['logfire.integrations'] = type(sys)('logfire.integrations')
    sys.modules['logfire.integrations.pydantic'] = type(sys)('logfire.integrations.pydantic')
