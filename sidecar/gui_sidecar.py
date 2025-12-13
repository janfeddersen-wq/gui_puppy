#!/usr/bin/env python3
"""
GUI Sidecar for code_puppy.
Runs a Socket.IO server that bridges GUI commands to code_puppy agents.
"""

import argparse
import asyncio
import sys
import os
from typing import Optional, Dict, Any
from queue import Empty

# Disable logfire before any pydantic imports to avoid PyInstaller issues
# logfire tries to inspect source code which doesn't exist in frozen executables
os.environ['LOGFIRE_IGNORE_NO_CONFIG'] = '1'
os.environ['PYDANTIC_DISABLE_PLUGINS'] = '1'
sys.modules['logfire'] = type(sys)('logfire')
sys.modules['logfire'].configure = lambda *args, **kwargs: None
sys.modules['logfire'].instrument_pydantic = lambda *args, **kwargs: None
sys.modules['logfire.integrations'] = type(sys)('logfire.integrations')
sys.modules['logfire.integrations.pydantic'] = type(sys)('logfire.integrations.pydantic')

import socketio
from aiohttp import web

import json
from pathlib import Path

# Import code_puppy components
try:
    import code_puppy
    from code_puppy import config
    from code_puppy.agents import load_agent, get_available_agents, get_agent_descriptions
    from code_puppy.messaging import (
        MessageBus,
        get_message_bus,
        reset_message_bus,
        MessageLevel,
        TextMessage,
        FileListingMessage,
        FileContentMessage,
        GrepResultMessage,
        DiffMessage,
        ShellStartMessage,
        ShellOutputMessage,
        AgentReasoningMessage,
        AgentResponseMessage,
        SubAgentInvocationMessage,
        SubAgentResponseMessage,
        UserInputRequest,
        UserInputResponse,
        ConfirmationRequest,
        ConfirmationResponse,
        SelectionRequest,
        SelectionResponse,
        StatusPanelMessage,
        DividerMessage,
        SpinnerControl,
        VersionCheckMessage,
    )
except ImportError as e:
    print(f"Error importing code_puppy: {e}", file=sys.stderr)
    print("Install with: pip install code-puppy", file=sys.stderr)
    sys.exit(1)

# Import OAuth utilities
try:
    from code_puppy.plugins.claude_code_oauth.utils import (
        prepare_oauth_context,
        assign_redirect_uri,
        build_authorization_url,
        exchange_code_for_tokens,
        fetch_claude_code_models,
        add_models_to_extra_config,
        load_stored_tokens,
        save_tokens,
        load_claude_models_filtered,
        remove_claude_code_models,
    )
    from code_puppy.plugins.claude_code_oauth.config import (
        CLAUDE_CODE_OAUTH_CONFIG,
        get_token_storage_path,
    )
    OAUTH_AVAILABLE = True
except ImportError as e:
    print(f"[Sidecar] OAuth plugin not available: {e}")
    OAUTH_AVAILABLE = False


def get_available_models() -> list:
    """Get list of available models from code_puppy's models.json and OAuth models."""
    models = set()
    try:
        pkg_dir = Path(code_puppy.__file__).parent
        models_file = pkg_dir / 'models.json'
        if models_file.exists():
            with open(models_file) as f:
                data = json.load(f)
            models.update(data.keys())

        # Also include Claude Code OAuth models if available
        if OAUTH_AVAILABLE:
            try:
                claude_models = load_claude_models_filtered()
                models.update(claude_models.keys())
            except Exception:
                pass
        return sorted(models)
    except Exception as e:
        print(f"[Sidecar] Error loading models: {e}")
        return []


class GUISidecar:
    """Socket.IO server that bridges GUI to code_puppy."""

    def __init__(self, port: int = 0):
        self.port = port
        self._running = False

        # Socket.IO server
        self.sio = socketio.AsyncServer(
            async_mode='aiohttp',
            cors_allowed_origins='*',
            logger=False,
            engineio_logger=False
        )
        self.app = web.Application()
        self.sio.attach(self.app)

        # State
        self._clients: set = set()
        self._pending_inputs: Dict[str, asyncio.Future] = {}
        self._current_task: Optional[asyncio.Task] = None
        self._working_directory: str = os.getcwd()

        # Get config values
        self._default_agent = config.get_default_agent() or "code-puppy"
        self._default_model = config.get_global_model_name()

        # Keep agent instance alive for conversation persistence
        self._current_agent = None
        self._current_agent_name: Optional[str] = None

        # OAuth state
        self._oauth_context = None
        self._oauth_server = None
        self._oauth_result = None
        self._oauth_event = None

        self._setup_handlers()

    def _setup_handlers(self):
        """Set up Socket.IO event handlers."""

        @self.sio.event
        async def connect(sid, environ):
            print(f"[Sidecar] Client connected: {sid}")
            self._clients.add(sid)

            agents = get_available_agents()
            await self.sio.emit('message', {
                'type': 'status',
                'content': f'Connected to code_puppy\nAgent: {self._default_agent}\nModel: {self._default_model}\nWorking directory: {self._working_directory}\nAvailable agents: {", ".join(agents)}'
            }, room=sid)
            # Send initial working directory
            await self.sio.emit('working_directory', {
                'path': self._working_directory
            }, room=sid)

        @self.sio.event
        async def disconnect(sid):
            print(f"[Sidecar] Client disconnected: {sid}")
            self._clients.discard(sid)
            if self._current_task and not self._current_task.done():
                self._current_task.cancel()

        @self.sio.event
        async def prompt(sid, data):
            """Handle prompt from GUI."""
            text = data.get('text', '').strip()
            if not text:
                await self.sio.emit('error', {'message': 'Empty prompt'}, room=sid)
                return

            print(f"[Sidecar] Prompt: {text[:80]}...")

            if self._current_task and not self._current_task.done():
                self._current_task.cancel()

            self._current_task = asyncio.create_task(self._run_prompt(sid, text))

        @self.sio.event
        async def cancel(sid, data=None):
            """Cancel running task."""
            if self._current_task and not self._current_task.done():
                self._current_task.cancel()
                await self.sio.emit('message', {
                    'type': 'status',
                    'content': 'Task cancelled'
                }, room=sid)

        @self.sio.event
        async def input_response(sid, data):
            """Handle user input response."""
            prompt_id = data.get('prompt_id')
            response = data.get('response', '')

            if prompt_id in self._pending_inputs:
                future = self._pending_inputs.pop(prompt_id)
                if not future.done():
                    future.set_result(('input', response))

        @self.sio.event
        async def confirmation_response(sid, data):
            """Handle confirmation response."""
            prompt_id = data.get('prompt_id')
            confirmed = data.get('confirmed', False)
            feedback = data.get('feedback')

            if prompt_id in self._pending_inputs:
                future = self._pending_inputs.pop(prompt_id)
                if not future.done():
                    future.set_result(('confirm', confirmed, feedback))

        @self.sio.event
        async def selection_response(sid, data):
            """Handle selection response."""
            prompt_id = data.get('prompt_id')
            selected = data.get('selected', [])

            if prompt_id in self._pending_inputs:
                future = self._pending_inputs.pop(prompt_id)
                if not future.done():
                    future.set_result(('select', selected))

        # ===== Configuration Events =====

        @self.sio.event
        async def get_config(sid, data=None):
            """Get current configuration."""
            try:
                agents = get_available_agents()
                agent_descs = get_agent_descriptions()
                models = get_available_models()

                # Get API keys (masked for display)
                api_key_names = [
                    "OPENAI_API_KEY",
                    "ANTHROPIC_API_KEY",
                    "GEMINI_API_KEY",
                    "CEREBRAS_API_KEY",
                    "OPENROUTER_API_KEY",
                    "AZURE_OPENAI_API_KEY",
                    "AZURE_OPENAI_ENDPOINT",
                ]
                api_keys = {}
                for key_name in api_key_names:
                    value = config.get_api_key(key_name)
                    # Return masked value for display, but indicate if set
                    api_keys[key_name] = {
                        'is_set': bool(value),
                        'masked': f"{'*' * 8}...{value[-4:]}" if value and len(value) > 4 else ('****' if value else ''),
                    }

                # Get model pinning
                model_pinning = config.get_all_agent_pinned_models()

                cfg = {
                    'current': {
                        'agent': config.get_default_agent() or 'code-puppy',
                        'model': config.get_global_model_name(),
                        'temperature': config.get_temperature(),
                        'yolo_mode': config.get_yolo_mode(),
                        'auto_save': config.get_auto_save_session(),
                        'suppress_thinking': config.get_suppress_thinking_messages(),
                        'suppress_info': config.get_suppress_informational_messages(),
                    },
                    'available': {
                        'agents': [
                            {'name': name, 'label': agents.get(name, name), 'description': agent_descs.get(name, '')}
                            for name in agents.keys()
                        ],
                        'models': models,
                    },
                    'api_keys': api_keys,
                    'model_pinning': model_pinning,
                }
                await self.sio.emit('config', cfg, room=sid)
            except Exception as e:
                print(f"[Sidecar] Error getting config: {e}")
                await self.sio.emit('error', {'message': f'Failed to get config: {e}'}, room=sid)

        @self.sio.event
        async def set_config(sid, data):
            """Update configuration."""
            try:
                changes = []

                if 'agent' in data:
                    agent_name = data['agent']
                    config.set_default_agent(agent_name)
                    self._default_agent = agent_name
                    # Reset agent instance so it gets reloaded on next prompt
                    self._current_agent = None
                    self._current_agent_name = None
                    changes.append(f"Agent: {agent_name}")

                if 'model' in data:
                    model_name = data['model']
                    config.set_model_name(model_name)
                    self._default_model = model_name
                    changes.append(f"Model: {model_name}")

                if 'temperature' in data:
                    temp = data['temperature']
                    if temp is not None:
                        config.set_temperature(float(temp))
                    changes.append(f"Temperature: {temp}")

                if 'yolo_mode' in data:
                    # yolo_mode is typically set via CLI, check if setter exists
                    changes.append(f"YOLO mode: {data['yolo_mode']} (session only)")

                if 'auto_save' in data:
                    config.set_auto_save_session(data['auto_save'])
                    changes.append(f"Auto-save: {data['auto_save']}")

                if 'suppress_thinking' in data:
                    config.set_suppress_thinking_messages(data['suppress_thinking'])
                    changes.append(f"Suppress thinking: {data['suppress_thinking']}")

                if 'suppress_info' in data:
                    config.set_suppress_informational_messages(data['suppress_info'])
                    changes.append(f"Suppress info: {data['suppress_info']}")

                await self.sio.emit('config_updated', {
                    'success': True,
                    'changes': changes
                }, room=sid)

                # Also send status message
                await self.sio.emit('message', {
                    'type': 'status',
                    'content': 'Configuration updated:\n' + '\n'.join(f'  • {c}' for c in changes)
                }, room=sid)

            except Exception as e:
                print(f"[Sidecar] Error setting config: {e}")
                await self.sio.emit('config_updated', {
                    'success': False,
                    'error': str(e)
                }, room=sid)

        @self.sio.event
        async def set_api_key(sid, data):
            """Set an API key."""
            try:
                key_name = data.get('key_name')
                value = data.get('value', '')

                if not key_name:
                    await self.sio.emit('api_key_result', {
                        'success': False,
                        'error': 'Key name is required'
                    }, room=sid)
                    return

                config.set_api_key(key_name, value)

                # Also set in environment for current session
                import os
                if value:
                    os.environ[key_name] = value
                elif key_name in os.environ:
                    del os.environ[key_name]

                await self.sio.emit('api_key_result', {
                    'success': True,
                    'key_name': key_name,
                    'message': f'{key_name} {"set" if value else "cleared"}'
                }, room=sid)

            except Exception as e:
                print(f"[Sidecar] Error setting API key: {e}")
                await self.sio.emit('api_key_result', {
                    'success': False,
                    'error': str(e)
                }, room=sid)

        @self.sio.event
        async def set_model_pin(sid, data):
            """Set or clear a model pin for an agent."""
            try:
                agent_name = data.get('agent_name')
                model_name = data.get('model_name', '')

                if not agent_name:
                    await self.sio.emit('model_pin_result', {
                        'success': False,
                        'error': 'Agent name is required'
                    }, room=sid)
                    return

                if model_name:
                    config.set_agent_pinned_model(agent_name, model_name)
                    message = f'Agent "{agent_name}" pinned to model "{model_name}"'
                else:
                    config.clear_agent_pinned_model(agent_name)
                    message = f'Model pin cleared for agent "{agent_name}"'

                await self.sio.emit('model_pin_result', {
                    'success': True,
                    'agent_name': agent_name,
                    'model_name': model_name,
                    'message': message
                }, room=sid)

            except Exception as e:
                print(f"[Sidecar] Error setting model pin: {e}")
                await self.sio.emit('model_pin_result', {
                    'success': False,
                    'error': str(e)
                }, room=sid)

        @self.sio.event
        async def set_working_directory(sid, data):
            """Set the working directory."""
            try:
                new_path = data.get('path', '')
                if not new_path:
                    await self.sio.emit('working_directory_result', {
                        'success': False,
                        'error': 'Path is required'
                    }, room=sid)
                    return

                # Validate path exists and is a directory
                if not os.path.isdir(new_path):
                    await self.sio.emit('working_directory_result', {
                        'success': False,
                        'error': f'Path does not exist or is not a directory: {new_path}'
                    }, room=sid)
                    return

                # Change directory
                os.chdir(new_path)
                self._working_directory = new_path

                await self.sio.emit('working_directory', {
                    'path': self._working_directory
                }, room=sid)

                await self.sio.emit('working_directory_result', {
                    'success': True,
                    'path': self._working_directory,
                    'message': f'Working directory changed to: {self._working_directory}'
                }, room=sid)

                await self.sio.emit('message', {
                    'type': 'status',
                    'content': f'Working directory changed to: {self._working_directory}'
                }, room=sid)

            except Exception as e:
                print(f"[Sidecar] Error setting working directory: {e}")
                await self.sio.emit('working_directory_result', {
                    'success': False,
                    'error': str(e)
                }, room=sid)

        # ===== OAuth Events =====

        @self.sio.event
        async def oauth_status(sid, data=None):
            """Get Claude Code OAuth status."""
            if not OAUTH_AVAILABLE:
                await self.sio.emit('oauth_status', {
                    'available': False,
                    'authenticated': False,
                    'error': 'OAuth plugin not installed'
                }, room=sid)
                return

            try:
                tokens = load_stored_tokens()
                authenticated = bool(tokens and tokens.get('access_token'))

                status = {
                    'available': True,
                    'authenticated': authenticated,
                    'models': [],
                }

                if authenticated:
                    import time
                    expires_at = tokens.get('expires_at')
                    if expires_at:
                        remaining = max(0, int(expires_at - time.time()))
                        hours, minutes = divmod(remaining // 60, 60)
                        status['expires_in'] = f"{hours}h {minutes}m"

                    # Get configured models
                    claude_models = load_claude_models_filtered()
                    status['models'] = [
                        name for name, cfg in claude_models.items()
                        if cfg.get('oauth_source') == 'claude-code-plugin'
                    ]

                await self.sio.emit('oauth_status', status, room=sid)
            except Exception as e:
                print(f"[Sidecar] Error getting OAuth status: {e}")
                await self.sio.emit('oauth_status', {
                    'available': True,
                    'authenticated': False,
                    'error': str(e)
                }, room=sid)

        @self.sio.event
        async def oauth_start(sid, data=None):
            """Start Claude Code OAuth flow."""
            if not OAUTH_AVAILABLE:
                await self.sio.emit('oauth_result', {
                    'success': False,
                    'error': 'OAuth plugin not installed'
                }, room=sid)
                return

            try:
                # Prepare OAuth context
                self._oauth_context = prepare_oauth_context()

                # Start callback server
                result = await self._start_oauth_server(self._oauth_context)
                if not result:
                    await self.sio.emit('oauth_result', {
                        'success': False,
                        'error': 'Could not start OAuth callback server'
                    }, room=sid)
                    return

                # Build authorization URL
                auth_url = build_authorization_url(self._oauth_context)

                # Send URL to client to open in browser
                await self.sio.emit('oauth_url', {
                    'url': auth_url,
                    'redirect_uri': self._oauth_context.redirect_uri
                }, room=sid)

                # Wait for callback in background
                asyncio.create_task(self._wait_for_oauth_callback(sid))

            except Exception as e:
                import traceback
                traceback.print_exc()
                await self.sio.emit('oauth_result', {
                    'success': False,
                    'error': str(e)
                }, room=sid)

        @self.sio.event
        async def oauth_logout(sid, data=None):
            """Remove Claude Code OAuth tokens."""
            if not OAUTH_AVAILABLE:
                await self.sio.emit('oauth_result', {
                    'success': False,
                    'error': 'OAuth plugin not installed'
                }, room=sid)
                return

            try:
                # Remove tokens
                token_path = get_token_storage_path()
                if token_path.exists():
                    token_path.unlink()

                # Remove models
                removed = remove_claude_code_models()

                await self.sio.emit('oauth_result', {
                    'success': True,
                    'message': f'Logged out. Removed {removed} Claude Code models.'
                }, room=sid)

                # Send updated status
                await self.sio.emit('oauth_status', {
                    'available': True,
                    'authenticated': False,
                    'models': []
                }, room=sid)

            except Exception as e:
                print(f"[Sidecar] Error during OAuth logout: {e}")
                await self.sio.emit('oauth_result', {
                    'success': False,
                    'error': str(e)
                }, room=sid)

    async def _start_oauth_server(self, context):
        """Start OAuth callback server."""
        import threading
        from http.server import BaseHTTPRequestHandler, HTTPServer
        from urllib.parse import parse_qs, urlparse

        port_range = CLAUDE_CODE_OAUTH_CONFIG["callback_port_range"]

        class CallbackHandler(BaseHTTPRequestHandler):
            oauth_result = {'code': None, 'state': None, 'error': None}
            oauth_event = threading.Event()

            def do_GET(self):
                parsed = urlparse(self.path)
                params = parse_qs(parsed.query)

                code = params.get('code', [None])[0]
                state = params.get('state', [None])[0]

                if code and state:
                    CallbackHandler.oauth_result = {'code': code, 'state': state, 'error': None}
                    self.send_response(200)
                    self.send_header('Content-Type', 'text/html')
                    self.end_headers()
                    self.wfile.write(b'''
                        <html><body style="font-family: system-ui; display: flex; justify-content: center; align-items: center; height: 100vh; margin: 0; background: #18181b; color: #fafafa;">
                        <div style="text-align: center;">
                            <h1>Authentication Successful!</h1>
                            <p>You can close this window and return to GUI Puppy.</p>
                        </div>
                        </body></html>
                    ''')
                else:
                    CallbackHandler.oauth_result = {'code': None, 'state': None, 'error': 'Missing code or state'}
                    self.send_response(400)
                    self.send_header('Content-Type', 'text/html')
                    self.end_headers()
                    self.wfile.write(b'''
                        <html><body style="font-family: system-ui; display: flex; justify-content: center; align-items: center; height: 100vh; margin: 0; background: #18181b; color: #fafafa;">
                        <div style="text-align: center;">
                            <h1>Authentication Failed</h1>
                            <p>Missing code or state parameter.</p>
                        </div>
                        </body></html>
                    ''')

                CallbackHandler.oauth_event.set()

            def log_message(self, format, *args):
                pass  # Suppress logging

        for port in range(port_range[0], port_range[1] + 1):
            try:
                server = HTTPServer(('localhost', port), CallbackHandler)
                assign_redirect_uri(context, port)

                # Reset event
                CallbackHandler.oauth_event = threading.Event()
                CallbackHandler.oauth_result = {'code': None, 'state': None, 'error': None}

                # Start server in thread
                def run_server():
                    server.handle_request()  # Handle single request then stop

                self._oauth_server = server
                self._oauth_handler = CallbackHandler
                threading.Thread(target=run_server, daemon=True).start()

                print(f"[Sidecar] OAuth callback server started on port {port}")
                return True
            except OSError:
                continue

        return False

    async def _wait_for_oauth_callback(self, sid: str):
        """Wait for OAuth callback and complete authentication."""
        timeout = CLAUDE_CODE_OAUTH_CONFIG.get('callback_timeout', 300)

        try:
            # Poll for callback (check every 0.5 seconds)
            for _ in range(timeout * 2):
                if self._oauth_handler.oauth_event.is_set():
                    break
                await asyncio.sleep(0.5)
            else:
                # Timeout
                await self.sio.emit('oauth_result', {
                    'success': False,
                    'error': 'OAuth callback timed out'
                }, room=sid)
                return

            result = self._oauth_handler.oauth_result

            if result.get('error'):
                await self.sio.emit('oauth_result', {
                    'success': False,
                    'error': result['error']
                }, room=sid)
                return

            if result.get('state') != self._oauth_context.state:
                await self.sio.emit('oauth_result', {
                    'success': False,
                    'error': 'State mismatch - possible CSRF attack'
                }, room=sid)
                return

            # Exchange code for tokens
            await self.sio.emit('message', {
                'type': 'status',
                'content': 'Exchanging authorization code for tokens...'
            }, room=sid)

            tokens = exchange_code_for_tokens(result['code'], self._oauth_context)
            if not tokens:
                await self.sio.emit('oauth_result', {
                    'success': False,
                    'error': 'Token exchange failed'
                }, room=sid)
                return

            # Save tokens
            if not save_tokens(tokens):
                await self.sio.emit('oauth_result', {
                    'success': False,
                    'error': 'Failed to save tokens'
                }, room=sid)
                return

            # Fetch and add models
            await self.sio.emit('message', {
                'type': 'status',
                'content': 'Fetching available Claude Code models...'
            }, room=sid)

            access_token = tokens.get('access_token')
            models = fetch_claude_code_models(access_token) if access_token else None

            if models:
                add_models_to_extra_config(models)
                await self.sio.emit('message', {
                    'type': 'status',
                    'content': f'Added {len(models)} Claude Code models'
                }, room=sid)

            await self.sio.emit('oauth_result', {
                'success': True,
                'message': 'Claude Code authentication successful!',
                'models_added': len(models) if models else 0
            }, room=sid)

            # Send updated status
            claude_models = load_claude_models_filtered()
            model_names = [
                name for name, cfg in claude_models.items()
                if cfg.get('oauth_source') == 'claude-code-plugin'
            ]
            await self.sio.emit('oauth_status', {
                'available': True,
                'authenticated': True,
                'models': model_names
            }, room=sid)

        except Exception as e:
            import traceback
            traceback.print_exc()
            await self.sio.emit('oauth_result', {
                'success': False,
                'error': str(e)
            }, room=sid)

    async def _run_prompt(self, sid: str, prompt_text: str):
        """Run a prompt through code_puppy agent."""
        bus = get_message_bus()

        try:
            # Only reload agent if agent type changed, otherwise reuse for conversation persistence
            if self._current_agent is None or self._current_agent_name != self._default_agent:
                # Reset message bus only when loading a new agent
                reset_message_bus()
                bus = get_message_bus()

                agent = load_agent(self._default_agent)
                if not agent:
                    await self.sio.emit('error', {
                        'message': f'Failed to load agent: {self._default_agent}'
                    }, room=sid)
                    await self.sio.emit('task_complete', {}, room=sid)
                    return

                self._current_agent = agent
                self._current_agent_name = self._default_agent
                print(f"[Sidecar] Loaded new agent: {self._default_agent}")
            else:
                agent = self._current_agent
                print(f"[Sidecar] Reusing existing agent: {self._default_agent}")

            # Mark renderer active so messages flow
            bus.mark_renderer_active()

            # Start message consumer
            consumer_task = asyncio.create_task(self._consume_messages(sid, bus))

            try:
                # Run the agent with MCP support
                result = await agent.run_with_mcp(prompt_text)

                # Give consumer time to process remaining messages
                await asyncio.sleep(0.2)

                # Emit final response if available
                if result:
                    # Result could be a string or have an output attribute
                    output = str(result.output) if hasattr(result, 'output') else str(result)
                    if output:
                        await self.sio.emit('message', {
                            'type': 'agent_response',
                            'content': output
                        }, room=sid)

            except asyncio.CancelledError:
                await self.sio.emit('message', {
                    'type': 'status',
                    'content': 'Task cancelled'
                }, room=sid)
            except Exception as e:
                import traceback
                traceback.print_exc()
                await self.sio.emit('error', {
                    'message': str(e)
                }, room=sid)
            finally:
                consumer_task.cancel()
                try:
                    await consumer_task
                except asyncio.CancelledError:
                    pass
                bus.mark_renderer_inactive()

            await self.sio.emit('task_complete', {}, room=sid)

        except Exception as e:
            import traceback
            traceback.print_exc()
            await self.sio.emit('error', {'message': str(e)}, room=sid)
            await self.sio.emit('task_complete', {}, room=sid)

    async def _consume_messages(self, sid: str, bus: MessageBus):
        """Consume messages from the bus and forward to GUI."""
        while True:
            try:
                try:
                    msg = bus.get_message_nowait()
                    # Skip None messages
                    if msg is not None:
                        await self._forward_message(sid, msg, bus)
                except Empty:
                    pass

                await asyncio.sleep(0.01)
            except asyncio.CancelledError:
                # Drain remaining messages
                for _ in range(100):
                    try:
                        msg = bus.get_message_nowait()
                        if msg is not None:
                            await self._forward_message(sid, msg, bus)
                    except Empty:
                        break
                raise
            except Exception as e:
                print(f"[Sidecar] Consumer error: {e}")

    async def _forward_message(self, sid: str, msg, bus: MessageBus):
        """Forward a message to the GUI client."""
        try:
            msg_type = type(msg).__name__

            if isinstance(msg, TextMessage):
                level_map = {
                    MessageLevel.DEBUG: 'debug',
                    MessageLevel.INFO: 'info',
                    MessageLevel.WARNING: 'warning',
                    MessageLevel.ERROR: 'error',
                    MessageLevel.SUCCESS: 'success',
                }
                await self.sio.emit('message', {
                    'type': 'text',
                    'content': msg.text,
                    'level': level_map.get(msg.level, 'info')
                }, room=sid)

            elif isinstance(msg, FileContentMessage):
                await self.sio.emit('message', {
                    'type': 'file_content',
                    'path': msg.path,
                    'content': msg.content,
                    'start_line': msg.start_line,
                    'num_lines': msg.num_lines,
                    'total_lines': msg.total_lines,
                    'num_tokens': msg.num_tokens,
                }, room=sid)

            elif isinstance(msg, DiffMessage):
                lines = []
                for line in msg.diff_lines:
                    prefix = {'add': '+', 'remove': '-', 'context': ' '}.get(line.type, ' ')
                    lines.append(f"{prefix}{line.content}")
                await self.sio.emit('message', {
                    'type': 'diff',
                    'path': msg.path,
                    'operation': msg.operation,
                    'diff_lines': [{'type': l.type, 'content': l.content, 'line_number': l.line_number} for l in msg.diff_lines],
                    'content': '\n'.join(lines)
                }, room=sid)

            elif isinstance(msg, ShellStartMessage):
                await self.sio.emit('message', {
                    'type': 'shell_start',
                    'command': msg.command,
                    'content': f"$ {msg.command}"
                }, room=sid)

            elif isinstance(msg, ShellOutputMessage):
                output = msg.stdout + (msg.stderr or '')
                await self.sio.emit('message', {
                    'type': 'shell_output',
                    'command': msg.command,
                    'stdout': msg.stdout,
                    'stderr': msg.stderr or '',
                    'exit_code': msg.exit_code,
                    'content': output
                }, room=sid)

            elif isinstance(msg, AgentReasoningMessage):
                await self.sio.emit('message', {
                    'type': 'reasoning',
                    'content': msg.reasoning,
                    'next_steps': msg.next_steps,
                }, room=sid)

            elif isinstance(msg, AgentResponseMessage):
                await self.sio.emit('message', {
                    'type': 'agent_response',
                    'content': msg.content
                }, room=sid)

            elif isinstance(msg, SubAgentInvocationMessage):
                await self.sio.emit('message', {
                    'type': 'sub_agent',
                    'agent_name': msg.agent_name,
                    'prompt': msg.prompt,
                    'session_id': msg.session_id,
                    'is_new_session': msg.is_new_session,
                    'content': f"[{msg.agent_name}] {msg.prompt[:100]}..."
                }, room=sid)

            elif isinstance(msg, SubAgentResponseMessage):
                await self.sio.emit('message', {
                    'type': 'sub_agent_response',
                    'agent_name': msg.agent_name,
                    'response': msg.response,
                    'content': msg.response
                }, room=sid)

            elif isinstance(msg, UserInputRequest):
                await self._handle_input_request(sid, msg, bus)

            elif isinstance(msg, ConfirmationRequest):
                await self._handle_confirmation_request(sid, msg, bus)

            elif isinstance(msg, SelectionRequest):
                await self._handle_selection_request(sid, msg, bus)

            elif isinstance(msg, SpinnerControl):
                await self.sio.emit('message', {
                    'type': 'spinner',
                    'action': msg.action,
                    'spinner_id': msg.spinner_id,
                    'content': getattr(msg, 'text', '')
                }, room=sid)

            elif isinstance(msg, GrepResultMessage):
                await self.sio.emit('message', {
                    'type': 'grep_result',
                    'search_term': msg.search_term,
                    'directory': msg.directory,
                    'matches': [{'file_path': m.file_path, 'line_number': m.line_number, 'line_content': m.line_content} for m in msg.matches],
                    'total_matches': msg.total_matches,
                    'files_searched': msg.files_searched,
                }, room=sid)

            elif isinstance(msg, FileListingMessage):
                await self.sio.emit('message', {
                    'type': 'file_listing',
                    'directory': msg.directory,
                    'files': [{'path': f.path, 'type': f.type, 'size': f.size, 'depth': f.depth} for f in msg.files],
                    'recursive': msg.recursive,
                    'total_size': msg.total_size,
                    'dir_count': msg.dir_count,
                    'file_count': msg.file_count,
                }, room=sid)

            elif isinstance(msg, StatusPanelMessage):
                await self.sio.emit('message', {
                    'type': 'status_panel',
                    'title': msg.title,
                    'fields': msg.fields,  # Dict[str, str]
                }, room=sid)

            elif isinstance(msg, DividerMessage):
                await self.sio.emit('message', {
                    'type': 'divider',
                    'content': '─' * 40
                }, room=sid)

            elif isinstance(msg, VersionCheckMessage):
                if msg.update_available:
                    await self.sio.emit('message', {
                        'type': 'version_check',
                        'content': f"Update available: {msg.current_version} → {msg.latest_version}"
                    }, room=sid)

            else:
                # Generic fallback
                content = getattr(msg, 'content', None) or getattr(msg, 'text', None)
                if content:
                    await self.sio.emit('message', {
                        'type': 'text',
                        'content': str(content)
                    }, room=sid)
                else:
                    print(f"[Sidecar] Unhandled message type: {msg_type}")

        except Exception as e:
            print(f"[Sidecar] Forward error for {type(msg).__name__}: {e}")

    async def _handle_input_request(self, sid: str, msg: UserInputRequest, bus: MessageBus):
        """Handle input request."""
        future = asyncio.Future()
        self._pending_inputs[msg.prompt_id] = future

        await self.sio.emit('input_request', {
            'prompt_id': msg.prompt_id,
            'prompt': msg.prompt
        }, room=sid)

        try:
            result = await asyncio.wait_for(future, timeout=300)
            _, response = result
            bus.provide_response(UserInputResponse(
                prompt_id=msg.prompt_id,
                response=response
            ))
        except asyncio.TimeoutError:
            bus.provide_response(UserInputResponse(
                prompt_id=msg.prompt_id,
                response=''
            ))

    async def _handle_confirmation_request(self, sid: str, msg: ConfirmationRequest, bus: MessageBus):
        """Handle confirmation request."""
        future = asyncio.Future()
        self._pending_inputs[msg.prompt_id] = future

        await self.sio.emit('confirmation_request', {
            'prompt_id': msg.prompt_id,
            'prompt': msg.prompt,
            'default': getattr(msg, 'default', True),
            'allow_feedback': getattr(msg, 'allow_feedback', False)
        }, room=sid)

        try:
            result = await asyncio.wait_for(future, timeout=300)
            _, confirmed, feedback = result
            bus.provide_response(ConfirmationResponse(
                prompt_id=msg.prompt_id,
                confirmed=confirmed,
                feedback=feedback
            ))
        except asyncio.TimeoutError:
            bus.provide_response(ConfirmationResponse(
                prompt_id=msg.prompt_id,
                confirmed=False,
                feedback=None
            ))

    async def _handle_selection_request(self, sid: str, msg: SelectionRequest, bus: MessageBus):
        """Handle selection request."""
        future = asyncio.Future()
        self._pending_inputs[msg.prompt_id] = future

        await self.sio.emit('selection_request', {
            'prompt_id': msg.prompt_id,
            'prompt': msg.prompt,
            'options': [{'label': o.label, 'value': o.value} for o in msg.options],
            'multi_select': getattr(msg, 'multi_select', False)
        }, room=sid)

        try:
            result = await asyncio.wait_for(future, timeout=300)
            _, selected = result
            bus.provide_response(SelectionResponse(
                prompt_id=msg.prompt_id,
                selected=selected if isinstance(selected, list) else [selected]
            ))
        except asyncio.TimeoutError:
            bus.provide_response(SelectionResponse(
                prompt_id=msg.prompt_id,
                selected=[]
            ))

    async def run(self):
        """Run the sidecar server."""
        if self.port == 0:
            import socket
            with socket.socket(socket.AF_INET, socket.SOCK_STREAM) as s:
                s.bind(('127.0.0.1', 0))
                self.port = s.getsockname()[1]

        runner = web.AppRunner(self.app)
        await runner.setup()

        site = web.TCPSite(runner, '127.0.0.1', self.port)
        await site.start()

        # Signal ready to Electron
        print(f"SIDECAR_READY port={self.port}")
        sys.stdout.flush()

        print(f"[Sidecar] Running on http://127.0.0.1:{self.port}")

        self._running = True
        try:
            while self._running:
                await asyncio.sleep(1)
        except asyncio.CancelledError:
            pass
        finally:
            await runner.cleanup()


async def main(port: int):
    sidecar = GUISidecar(port=port)
    await sidecar.run()


if __name__ == '__main__':
    parser = argparse.ArgumentParser(description='GUI Sidecar for code_puppy')
    parser.add_argument('--port', '-p', type=int, default=0, help='Port (0 = auto)')
    args = parser.parse_args()

    try:
        asyncio.run(main(args.port))
    except KeyboardInterrupt:
        print("\n[Sidecar] Shutting down...")
