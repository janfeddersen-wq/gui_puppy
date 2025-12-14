"""
Message handler for forwarding code_puppy messages to the GUI.
"""

import asyncio
import sys
from queue import Empty
from typing import Dict, Any

from code_puppy.messaging import (
    MessageBus,
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


class MessageHandler:
    """Handles forwarding messages from code_puppy to the GUI."""

    def __init__(self, sio, pending_inputs: Dict[str, asyncio.Future]):
        self.sio = sio
        self._pending_inputs = pending_inputs

    async def consume_messages(self, sid: str, bus: MessageBus):
        """Consume messages from the bus and forward to GUI."""
        msg_count = 0
        while True:
            try:
                try:
                    msg = bus.get_message_nowait()
                    if msg is not None:
                        msg_count += 1
                        print(f"[Sidecar] Message {msg_count}: {type(msg).__name__}")
                        sys.stdout.flush()
                        await self.forward_message(sid, msg, bus)
                except Empty:
                    pass

                await asyncio.sleep(0.01)
            except asyncio.CancelledError:
                print(f"[Sidecar] Consumer cancelled after {msg_count} messages")
                sys.stdout.flush()
                # Drain remaining messages
                for _ in range(100):
                    try:
                        msg = bus.get_message_nowait()
                        if msg is not None:
                            await self.forward_message(sid, msg, bus)
                    except Empty:
                        break
                raise
            except Exception as e:
                print(f"[Sidecar] Consumer error: {e}")

    async def forward_message(self, sid: str, msg, bus: MessageBus):
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
                    'session_id': msg.session_id,
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
                    'fields': msg.fields,
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
