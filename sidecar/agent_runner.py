"""
Agent runner for executing code_puppy agents.
"""

import asyncio
import base64
import sys
import traceback
from typing import Optional, List, Dict, Any

from pydantic_ai import BinaryContent

from code_puppy.agents import load_agent
from code_puppy.messaging import (
    MessageBus,
    get_message_bus,
    reset_message_bus,
)

from message_handler import MessageHandler


class AgentRunner:
    """Handles running code_puppy agents."""

    def __init__(self, sio, message_handler: MessageHandler, config_handler):
        self.sio = sio
        self.message_handler = message_handler
        self.config_handler = config_handler
        self._current_agent = None
        self._current_agent_name: Optional[str] = None
        self._credentials_version = 0

    def increment_credentials_version(self):
        """Increment credentials version to force agent reload."""
        self._credentials_version += 1
        if self._current_agent is not None:
            self._current_agent._code_generation_agent = None
            print(f"[Sidecar] Credentials changed - cleared cached pydantic agent")

    def reset_agent(self):
        """Reset the current agent."""
        self._current_agent = None
        self._current_agent_name = None

    async def run_prompt(self, sid: str, prompt_text: str, images: List[Dict[str, Any]] = None):
        """Run a prompt through code_puppy agent."""
        print(f"[Sidecar] run_prompt called with text={prompt_text[:50]}... images={len(images) if images else 0}")
        sys.stdout.flush()

        print(f"[Sidecar] Getting message bus...")
        sys.stdout.flush()
        bus = get_message_bus()
        print(f"[Sidecar] Got message bus")
        sys.stdout.flush()

        try:
            default_agent = self.config_handler.default_agent
            default_model = self.config_handler.default_model

            # Check if we need to reload the agent
            need_new_agent = (
                self._current_agent is None or
                self._current_agent_name != default_agent
            )

            # Also check if the model changed
            model_changed = False
            if self._current_agent is not None:
                current_model = self._current_agent.get_model_name()
                if current_model != default_model:
                    model_changed = True
                    print(f"[Sidecar] Model changed from {current_model} to {default_model}")
                    sys.stdout.flush()

            if need_new_agent:
                print(f"[Sidecar] Need to load new agent: {default_agent}")
                sys.stdout.flush()
                reset_message_bus()
                bus = get_message_bus()
                print(f"[Sidecar] Message bus reset, loading agent...")
                sys.stdout.flush()

                agent = load_agent(default_agent)
                print(f"[Sidecar] load_agent returned: {agent}")
                sys.stdout.flush()
                if not agent:
                    await self.sio.emit('error', {
                        'message': f'Failed to load agent: {default_agent}'
                    }, room=sid)
                    await self.sio.emit('task_complete', {}, room=sid)
                    return

                self._current_agent = agent
                self._current_agent_name = default_agent
                print(f"[Sidecar] Loaded new agent: {default_agent}")
            else:
                agent = self._current_agent
                print(f"[Sidecar] Reusing existing agent: {default_agent}")

                if model_changed:
                    print(f"[Sidecar] Forcing pydantic agent reload due to model change")
                    sys.stdout.flush()
                    agent._code_generation_agent = None
                    agent._model_name = default_model

            # Mark renderer active
            bus.mark_renderer_active()

            # Start message consumer
            consumer_task = asyncio.create_task(
                self.message_handler.consume_messages(sid, bus)
            )

            # Convert images to BinaryContent attachments
            attachments = self._process_images(images)

            try:
                print(f"[Sidecar] Running agent.run_with_mcp with {len(attachments) if attachments else 0} attachments")
                print(f"[Sidecar] Current model: {default_model}")
                sys.stdout.flush()

                result = await agent.run_with_mcp(
                    prompt_text,
                    attachments=attachments if attachments else None
                )

                print(f"[Sidecar] run_with_mcp returned successfully")
                sys.stdout.flush()

                # Give consumer time to process remaining messages
                await asyncio.sleep(0.2)

                # Emit final response if available
                response_output = self._extract_response(result, agent)

                if response_output:
                    print(f"[Sidecar] Emitting agent response")
                    sys.stdout.flush()
                    await self.sio.emit('message', {
                        'type': 'agent_response',
                        'content': response_output
                    }, room=sid)

            except asyncio.CancelledError:
                print("[Sidecar] Task was cancelled")
                sys.stdout.flush()
                await self.sio.emit('message', {
                    'type': 'status',
                    'content': 'Task cancelled'
                }, room=sid)
            except Exception as e:
                print(f"[Sidecar] Exception in agent.run_with_mcp: {e}")
                traceback.print_exc()
                sys.stdout.flush()
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
            traceback.print_exc()
            await self.sio.emit('error', {'message': str(e)}, room=sid)
            await self.sio.emit('task_complete', {}, room=sid)

    def _process_images(self, images: List[Dict[str, Any]] = None) -> List[BinaryContent]:
        """Convert image data URLs to BinaryContent attachments."""
        if not images:
            return None

        attachments = []
        for img in images:
            try:
                data_url = img.get('dataUrl', '')
                mime_type = img.get('mimeType', 'image/png')

                if data_url.startswith('data:'):
                    parts = data_url.split(',', 1)
                    if len(parts) == 2:
                        base64_data = parts[1]
                        image_bytes = base64.b64decode(base64_data)
                        attachments.append(BinaryContent(data=image_bytes, media_type=mime_type))
                        print(f"[Sidecar] Added image attachment: {img.get('name', 'unknown')} ({len(image_bytes)} bytes)")
            except Exception as e:
                print(f"[Sidecar] Error processing image: {e}")

        return attachments if attachments else None

    def _extract_response(self, result, agent) -> Optional[str]:
        """Extract response from agent result or message history."""
        response_output = None

        if result:
            response_output = str(result.output) if hasattr(result, 'output') else str(result)
        elif result is None:
            # Try to get the response from the agent's message history
            history = agent.get_message_history()
            if history:
                last_msg = history[-1]
                if hasattr(last_msg, 'parts'):
                    for part in last_msg.parts:
                        if hasattr(part, 'content') and isinstance(part.content, str):
                            response_output = part.content
                            print(f"[Sidecar] Found response in history: {response_output[:100]}...")
                            break

        return response_output
