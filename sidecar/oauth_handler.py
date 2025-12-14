"""
OAuth handler for Claude Code authentication.
"""

import asyncio
import sys
import threading
from http.server import BaseHTTPRequestHandler, HTTPServer
from urllib.parse import parse_qs, urlparse
from typing import Optional, Any

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


class OAuthCallbackHandler(BaseHTTPRequestHandler):
    """HTTP handler for OAuth callback."""
    oauth_result = {'code': None, 'state': None, 'error': None}
    oauth_event = threading.Event()

    def do_GET(self):
        parsed = urlparse(self.path)
        params = parse_qs(parsed.query)

        code = params.get('code', [None])[0]
        state = params.get('state', [None])[0]

        if code and state:
            OAuthCallbackHandler.oauth_result = {'code': code, 'state': state, 'error': None}
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
            OAuthCallbackHandler.oauth_result = {'code': None, 'state': None, 'error': 'Missing code or state'}
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

        OAuthCallbackHandler.oauth_event.set()

    def log_message(self, format, *args):
        pass  # Suppress logging


class OAuthHandler:
    """Handles OAuth authentication flow."""

    def __init__(self, sio):
        self.sio = sio
        self._oauth_context = None
        self._oauth_server = None
        self._oauth_handler = OAuthCallbackHandler

    async def get_status(self, sid: str):
        """Get OAuth status."""
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

    async def start_flow(self, sid: str, on_complete_callback=None):
        """Start OAuth authentication flow."""
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
            result = await self._start_server(self._oauth_context)
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
            asyncio.create_task(self._wait_for_callback(sid, on_complete_callback))

        except Exception as e:
            import traceback
            traceback.print_exc()
            await self.sio.emit('oauth_result', {
                'success': False,
                'error': str(e)
            }, room=sid)

    async def logout(self, sid: str):
        """Remove OAuth tokens."""
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

    async def _start_server(self, context) -> bool:
        """Start OAuth callback server."""
        port_range = CLAUDE_CODE_OAUTH_CONFIG["callback_port_range"]

        for port in range(port_range[0], port_range[1] + 1):
            try:
                server = HTTPServer(('localhost', port), OAuthCallbackHandler)
                assign_redirect_uri(context, port)

                # Reset event
                OAuthCallbackHandler.oauth_event = threading.Event()
                OAuthCallbackHandler.oauth_result = {'code': None, 'state': None, 'error': None}

                # Start server in thread
                def run_server():
                    server.handle_request()  # Handle single request then stop

                self._oauth_server = server
                threading.Thread(target=run_server, daemon=True).start()

                print(f"[Sidecar] OAuth callback server started on port {port}")
                return True
            except OSError:
                continue

        return False

    async def _wait_for_callback(self, sid: str, on_complete_callback=None):
        """Wait for OAuth callback and complete authentication."""
        timeout = CLAUDE_CODE_OAUTH_CONFIG.get('callback_timeout', 300)

        try:
            # Poll for callback (check every 0.5 seconds)
            for _ in range(timeout * 2):
                if OAuthCallbackHandler.oauth_event.is_set():
                    break
                await asyncio.sleep(0.5)
            else:
                # Timeout
                await self.sio.emit('oauth_result', {
                    'success': False,
                    'error': 'OAuth callback timed out'
                }, room=sid)
                return

            result = OAuthCallbackHandler.oauth_result

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

            # Call completion callback if provided
            if on_complete_callback:
                on_complete_callback()

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
