# GUI Puppy

Electron GUI for [code_puppy](https://github.com/mpfaffenberger/code_puppy) AI agent using Socket.IO for communication.

Built with:
- **Electron** - Desktop app framework
- **React + TypeScript** - Modular UI
- **Material UI** - Zinc dark theme
- **Socket.IO** - Real-time communication with code_puppy

## Prerequisites

- Node.js 18+
- Python 3.11+
- code_puppy configured with API keys

## Setup

1. Install Node.js dependencies:
   ```bash
   npm install
   ```

2. Create Python virtual environment and install sidecar dependencies:
   ```bash
   uv venv sidecar/.venv
   uv pip install -r sidecar/requirements.txt -p sidecar/.venv
   ```

3. Configure code_puppy:
   - Set up your API keys (OPENAI_API_KEY, ANTHROPIC_API_KEY, etc.)
   - Configure default agent and model via `pup` CLI or config file

## Running

**Development** (with hot-reload and DevTools):
```bash
npm run dev
```

**Production**:
```bash
npm start
```

## Project Structure

```
gui_puppy/
├── src/
│   ├── main/              # Electron main process
│   │   ├── index.js       # App entry, sidecar management
│   │   └── preload.js     # IPC bridge
│   └── renderer/          # React UI (TypeScript)
│       ├── components/    # Modular UI components
│       │   ├── Header.tsx
│       │   ├── MessageBubble.tsx
│       │   ├── MessageList.tsx
│       │   └── InputArea.tsx
│       ├── hooks/         # Custom React hooks
│       │   └── useSocket.ts
│       ├── theme/         # Material UI Zinc theme
│       │   └── zinc.ts
│       ├── App.tsx        # Main app component
│       ├── main.tsx       # React entry
│       └── types.ts       # TypeScript definitions
├── sidecar/
│   ├── gui_sidecar.py     # Socket.IO server bridging to code_puppy
│   ├── requirements.txt   # Python dependencies
│   └── .venv/             # Python virtual environment
├── package.json
├── vite.config.ts
└── tsconfig.json
```

## Architecture

```
┌─────────────────────────────────────────────────────────┐
│                    Electron App                          │
│  ┌──────────────┐           ┌────────────────────────┐  │
│  │ Main Process │           │   Renderer (React)     │  │
│  │              │◄─────────►│   - Material UI Zinc   │  │
│  │ - Spawns     │   IPC     │   - Socket.IO client   │  │
│  │   sidecar    │           │   - Message components │  │
│  │ - Port mgmt  │           │                        │  │
│  └──────┬───────┘           └───────────┬────────────┘  │
│         │                               │               │
└─────────┼───────────────────────────────┼───────────────┘
          │ spawn                         │ Socket.IO
          ▼                               ▼
┌─────────────────────────────────────────────────────────┐
│                   Python Sidecar                         │
│  ┌──────────────────────────────────────────────────┐   │
│  │              gui_sidecar.py                       │   │
│  │  - Socket.IO server (dynamic port)               │   │
│  │  - Consumes code_puppy MessageBus                │   │
│  │  - Forwards all message types to GUI             │   │
│  │  - Handles user input/confirmation/selection     │   │
│  └──────────────────────┬───────────────────────────┘   │
│                         │ uses                          │
│                         ▼                               │
│  ┌──────────────────────────────────────────────────┐   │
│  │           code_puppy (unmodified)                 │   │
│  │  - MessageBus for bidirectional I/O              │   │
│  │  - Agents, Tools, Config                         │   │
│  └──────────────────────────────────────────────────┘   │
└─────────────────────────────────────────────────────────┘
```

## Socket.IO Protocol

**Client → Server:**
| Event | Payload | Description |
|-------|---------|-------------|
| `prompt` | `{text: string}` | Send user prompt |
| `cancel` | - | Cancel current task |
| `input_response` | `{prompt_id, response}` | Text input response |
| `confirmation_response` | `{prompt_id, confirmed, feedback?}` | Confirmation response |
| `selection_response` | `{prompt_id, selected[]}` | Selection response |

**Server → Client:**
| Event | Payload | Description |
|-------|---------|-------------|
| `message` | `{type, content, ...}` | Agent output |
| `input_request` | `{prompt_id, prompt}` | Request text input |
| `confirmation_request` | `{prompt_id, prompt, ...}` | Request confirmation |
| `selection_request` | `{prompt_id, prompt, options}` | Request selection |
| `task_complete` | `{}` | Task finished |
| `error` | `{message}` | Error occurred |

## Message Types

- `agent_response` - Final agent response
- `reasoning` - Agent's thinking process
- `text` - General text (info/warning/error/success)
- `diff` - File diff with path and operation
- `shell_start` / `shell_output` - Shell command execution
- `file_content` - File content display
- `file_listing` - Directory listing
- `grep_result` - Search results
- `spinner` - Loading indicators
- `status_panel` - Status information
- `sub_agent` - Sub-agent invocation
