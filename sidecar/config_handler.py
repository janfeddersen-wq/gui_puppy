"""
Configuration handler for the GUI sidecar.
"""

import json
import os
from pathlib import Path
from typing import Dict, List, Any

import code_puppy
from code_puppy import config
from code_puppy.agents import get_available_agents, get_agent_descriptions

# Import OAuth utilities for model loading
try:
    from code_puppy.plugins.claude_code_oauth.utils import load_claude_models_filtered
    OAUTH_AVAILABLE = True
except ImportError:
    OAUTH_AVAILABLE = False


def get_available_models() -> List[str]:
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


class ConfigHandler:
    """Handles configuration operations for the sidecar."""

    def __init__(self, sio):
        self.sio = sio
        self._default_agent = config.get_default_agent() or "code-puppy"
        self._default_model = config.get_global_model_name()
        self._working_directory = os.getcwd()

    @property
    def default_agent(self) -> str:
        return self._default_agent

    @default_agent.setter
    def default_agent(self, value: str):
        self._default_agent = value

    @property
    def default_model(self) -> str:
        return self._default_model

    @default_model.setter
    def default_model(self, value: str):
        self._default_model = value

    @property
    def working_directory(self) -> str:
        return self._working_directory

    @working_directory.setter
    def working_directory(self, value: str):
        self._working_directory = value

    async def get_config(self, sid: str):
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

    async def set_config(self, sid: str, data: Dict[str, Any]) -> tuple:
        """Update configuration. Returns (success, should_reset_agent)."""
        should_reset_agent = False
        try:
            changes = []

            if 'agent' in data:
                agent_name = data['agent']
                config.set_default_agent(agent_name)
                self._default_agent = agent_name
                should_reset_agent = True
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

            await self.sio.emit('message', {
                'type': 'status',
                'content': 'Configuration updated:\n' + '\n'.join(f'  • {c}' for c in changes)
            }, room=sid)

            return True, should_reset_agent

        except Exception as e:
            print(f"[Sidecar] Error setting config: {e}")
            await self.sio.emit('config_updated', {
                'success': False,
                'error': str(e)
            }, room=sid)
            return False, False

    async def set_api_key(self, sid: str, data: Dict[str, Any]):
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

    async def set_model_pin(self, sid: str, data: Dict[str, Any]):
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

    async def set_working_directory(self, sid: str, data: Dict[str, Any]):
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
