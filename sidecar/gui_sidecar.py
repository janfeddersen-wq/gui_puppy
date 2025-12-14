#!/usr/bin/env python3
"""
GUI Sidecar for code_puppy.
Runs a Socket.IO server that bridges GUI commands to code_puppy agents.
"""

import argparse
import asyncio
import sys
import os
from typing import Optional, Dict

# Install logfire mock before any other imports
from logfire_mock import install_mock
install_mock()

import socketio
from aiohttp import web

from code_puppy.agents import get_available_agents

from config_handler import ConfigHandler
from oauth_handler import OAuthHandler
from message_handler import MessageHandler
from agent_runner import AgentRunner


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

        # Initialize handlers
        self.config_handler = ConfigHandler(self.sio)
        self.oauth_handler = OAuthHandler(self.sio)
        self.message_handler = MessageHandler(self.sio, self._pending_inputs)
        self.agent_runner = AgentRunner(self.sio, self.message_handler, self.config_handler)

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
                'content': f'Connected to code_puppy\nAgent: {self.config_handler.default_agent}\nModel: {self.config_handler.default_model}\nWorking directory: {self.config_handler.working_directory}\nAvailable agents: {", ".join(agents)}'
            }, room=sid)
            await self.sio.emit('working_directory', {
                'path': self.config_handler.working_directory
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
            images = data.get('images', [])

            if not text and not images:
                await self.sio.emit('error', {'message': 'Empty prompt'}, room=sid)
                return

            print(f"[Sidecar] Prompt: {text[:80]}... ({len(images)} images)")

            if self._current_task and not self._current_task.done():
                self._current_task.cancel()

            self._current_task = asyncio.create_task(
                self.agent_runner.run_prompt(sid, text, images)
            )

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
            await self.config_handler.get_config(sid)

        @self.sio.event
        async def set_config(sid, data):
            """Update configuration."""
            success, should_reset = await self.config_handler.set_config(sid, data)
            if should_reset:
                self.agent_runner.reset_agent()

        @self.sio.event
        async def set_api_key(sid, data):
            """Set an API key."""
            await self.config_handler.set_api_key(sid, data)

        @self.sio.event
        async def set_model_pin(sid, data):
            """Set or clear a model pin for an agent."""
            await self.config_handler.set_model_pin(sid, data)

        @self.sio.event
        async def set_working_directory(sid, data):
            """Set the working directory."""
            await self.config_handler.set_working_directory(sid, data)

        # ===== OAuth Events =====

        @self.sio.event
        async def oauth_status(sid, data=None):
            """Get Claude Code OAuth status."""
            await self.oauth_handler.get_status(sid)

        @self.sio.event
        async def oauth_start(sid, data=None):
            """Start Claude Code OAuth flow."""
            await self.oauth_handler.start_flow(
                sid,
                on_complete_callback=self.agent_runner.increment_credentials_version
            )

        @self.sio.event
        async def oauth_logout(sid, data=None):
            """Remove Claude Code OAuth tokens."""
            await self.oauth_handler.logout(sid)

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
